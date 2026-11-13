import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@/auth/auth.service';
import { MagicLinkService } from '@/auth/magic-link.service';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';
import { PortalType } from '@/auth/dto/auth.dto';
import { User, Role } from '@/database/entities/user.entity';
import { Cohort, CohortStatus } from '@/database/entities/cohort.entity';
import { Participant } from '@/database/entities/participant.entity';
import { Team, TeamMember } from '@/database/entities/team.entity';
import { Mentor, MentorClaim, ScheduledSession } from '@/database/entities/mentor.entity';
import { RefreshToken } from '@/database/entities/refresh-token.entity';
import { VerificationCode, VerificationCodeType } from '@/database/entities/verification-code.entity';
import { ParticipantsService } from '@/modules/participants/participants.service';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { Stage } from '@/database/entities/stage.entity';
import { Evaluation } from '@/database/entities/evaluation.entity';
import * as path from 'path';

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
// This suite requires a dedicated disposable database, never the app database.
const integration = databaseUrl ? describe : describe.skip;
integration('PostgreSQL remediation regressions', () => {
  let db: DataSource;
  let auth: AuthService;
  let magic: MagicLinkService;
  let account: User;
  let cohort: Cohort;
  const config = new ConfigService({ jwt: { secret: 'local-regression-secret' } });

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!url.pathname.match(/^\/acmp_regression_[a-z0-9_]+_test$/) || !['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) throw new Error('A disposable local acmp_regression_*_test database is required');
    db = new DataSource({ type: 'postgres', url: databaseUrl, entities: [path.join(__dirname, '../../src/database/entities/*.entity.ts')], migrations: [path.join(__dirname, '../../src/database/migrations/*.ts')], synchronize: false });
    await db.initialize();
    await db.runMigrations();
    auth = new AuthService(db.getRepository(User), db.getRepository(RefreshToken), db.getRepository(Participant), db.getRepository(Cohort), db.getRepository(Mentor), new JwtService({ secret: 'local-regression-secret' }), {} as any, config);
    magic = new MagicLinkService(db.getRepository(VerificationCode), db.getRepository(User), db.getRepository('Organization') as any, db.getRepository(Mentor), auth, config, {} as any);
    account = await db.getRepository(User).save({ email: 'staff@example.test', role: Role.PROGRAM_MANAGER, firstName: 'Test', lastName: 'Staff', isActive: true });
    cohort = await db.getRepository(Cohort).save({ name: 'Regression cohort', status: CohortStatus.ACTIVE, teamSizeMax: 1 });
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });

  async function participant() { const id = randomUUID(); return db.getRepository(Participant).save({ participantId: id, email: id + '@example.test', firstName: 'Test', lastName: 'Participant', country: 'GH', cohortId: cohort.id }); }
  async function team() { const id = randomUUID(); return db.getRepository(Team).save({ name: id, inviteCode: id, cohortId: cohort.id }); }
  async function mentor() { return db.getRepository(Mentor).save({ email: randomUUID() + '@example.test', firstName: 'Test', lastName: 'Mentor', cohortId: cohort.id, maxClaims: 1 }); }
  function winners(results: PromiseSettledResult<unknown>[]) { return results.filter(result => result.status === 'fulfilled').length; }

  it('selects no credentials by default, including eager nested participants', async () => {
    const p = await participant(); const t = await team();
    await db.getRepository(Participant).update(p.id, { passwordHash: 'sensitive', passwordResetToken: 'reset' });
    await db.getRepository(TeamMember).save({ teamId: t.id, participantId: p.id });
    const member = await db.getRepository(TeamMember).findOneByOrFail({ participantId: p.id });
    expect(member.participant.passwordHash).toBeUndefined();
    expect(member.participant.passwordResetToken).toBeUndefined();
  });
  it('allows exactly one concurrent magic-code consumption and rejects replay', async () => {
    await db.getRepository(VerificationCode).save({ email: account.email, userId: account.id, type: VerificationCodeType.MAGIC_LINK, portal: PortalType.STAFF, code: createHash('sha256').update('123456').digest('hex'), expiresAt: new Date(Date.now() + 60000) });
    expect(winners(await Promise.allSettled(Array.from({ length: 5 }, () => magic.verifyCode(account.email, '123456'))))).toBe(1);
    await expect(magic.verifyCode(account.email, '123456')).rejects.toThrow();
  });
  it('limits concurrent wrong-code attempts and refuses expired codes', async () => {
    const code = await db.getRepository(VerificationCode).save({ email: account.email, userId: account.id, type: VerificationCodeType.MAGIC_LINK, portal: PortalType.STAFF, code: createHash('sha256').update('654321').digest('hex'), expiresAt: new Date(Date.now() + 60000) });
    expect(winners(await Promise.allSettled(Array.from({ length: 8 }, () => magic.verifyCode(account.email, '000000'))))).toBe(0);
    expect((await db.getRepository(VerificationCode).findOneByOrFail({ id: code.id })).attempts).toBe(5);
    await expect(magic.verifyCode(account.email, '654321')).rejects.toThrow();
    await db.getRepository(VerificationCode).update(code.id, { expiresAt: new Date(0), attempts: 0 });
    await expect(magic.verifyCode(account.email, '654321')).rejects.toThrow();
  });
  it('consumes a password reset once under concurrency and writes SQL NULLs', async () => {
    const issued = await auth.requestPasswordReset(account.email, PortalType.STAFF);
    expect(issued).not.toBeNull();
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => auth.resetPassword(issued!.token, 'New-password-123!')));
    expect(winners(results)).toBe(1);
    const [row] = await db.query('SELECT password_reset_token, password_reset_expires FROM users WHERE id = $1', [account.id]);
    expect(row).toEqual({ password_reset_token: null, password_reset_expires: null });
    await expect(auth.resetPassword(issued!.token, 'Another-password-123!')).rejects.toThrow();
  });
  it('lets an imported participant reset their Build password and sign in without learning-platform credentials', async () => {
    const p = await participant();
    const issued = await auth.requestPasswordReset(`  ${p.email.toUpperCase()}  `, PortalType.PARTICIPANT);
    expect(issued).not.toBeNull();
    const stored = await db.getRepository(Participant).findOneOrFail({ where: { id: p.id }, select: { id: true, passwordResetToken: true } });
    expect(stored.passwordResetToken).not.toBe(issued!.token);
    expect(stored.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(await auth.resetPassword(issued!.token, 'New-password-123!')).toEqual({ portal: PortalType.PARTICIPANT });
    const signedIn = await auth.loginWithPassword(p.email, 'New-password-123!', PortalType.PARTICIPANT);
    expect(signedIn.user).toMatchObject({ id: p.id, role: 'participant', mustChangePassword: false });
    await expect(auth.resetPassword(issued!.token, 'Another-password-123!')).rejects.toThrow();
  });
  it('revokes issued access sessions after logout and denies archived cohorts', async () => {
    const issued = await auth.generateTokens(account);
    const jwt = new JwtService({ secret: 'local-regression-secret' });
    const payload = jwt.verify(issued.accessToken);
    const strategy = new JwtStrategy(config, db);
    expect((await strategy.validate(payload)).id).toBe(account.id);
    await auth.logout(issued.refreshToken);
    await expect(strategy.validate(payload)).rejects.toThrow('Session has ended');
    const p = await participant();
    const token = await db.getRepository(RefreshToken).save({ token: randomUUID(), participantId: p.id, expiresAt: new Date(Date.now() + 60000) });
    await db.getRepository(Cohort).update(cohort.id, { status: CohortStatus.ARCHIVED });
    await expect(strategy.validate({ sub: p.id, sid: token.id, role: 'participant', iat: 1, exp: 9999999999 })).rejects.toThrow('COHORT_NOT_ACCESSIBLE');
    await db.getRepository(Cohort).update(cohort.id, { status: CohortStatus.ACTIVE });
  });
  it('enforces team capacity across concurrent inserts', async () => {
    const t = await team(); const a = await participant(); const b = await participant();
    expect(winners(await Promise.allSettled([a,b].map(p => db.getRepository(TeamMember).save({ teamId: t.id, participantId: p.id }))))).toBe(1);
    expect(await db.getRepository(TeamMember).countBy({ teamId: t.id })).toBe(1);
  });
  it('prevents a participant from joining two confirmed teams concurrently', async () => {
    const p = await participant(); const a = await team(); const b = await team();
    expect(winners(await Promise.allSettled([a,b].map(t => db.getRepository(TeamMember).save({ teamId: t.id, participantId: p.id }))))).toBe(1);
  });
  it('enforces mentor capacity across concurrent claims', async () => {
    const m = await mentor(); const a = await team(); const b = await team();
    expect(winners(await Promise.allSettled([a,b].map(t => db.getRepository(MentorClaim).save({ teamId: t.id, mentorId: m.id, claimedBy: account.id, expiresAt: new Date(Date.now() + 60000) }))))).toBe(1);
  });
  it('prevents overlapping pending bookings across concurrent transactions', async () => {
    const m = await mentor(); const t = await team();
    const claim = await db.getRepository(MentorClaim).save({ teamId: t.id, mentorId: m.id, claimedBy: account.id, expiresAt: new Date(Date.now() + 60000) });
    const booking = { claimId: claim.id, mentorId: m.id, teamId: t.id, bookedBy: account.id, scheduledAt: new Date('2030-02-01T10:00:00Z'), durationMinutes: 45, question: 'How should we implement this?', sessionNumber: 1 };
    expect(winners(await Promise.allSettled([db.getRepository(ScheduledSession).save({ ...booking }), db.getRepository(ScheduledSession).save({ ...booking, scheduledAt: new Date('2030-02-01T10:30:00Z') })]))).toBe(1);
  });
  it('has no missing stage columns or untracked indexes after migrations', async () => {
    const drift = await db.driver.createSchemaBuilder().log();
    expect(drift.upQueries.map(query => query.query)).toEqual([]);
  });
  it('restores participants with clean credentials, memberships, and revoked sessions', async () => {
    const p = await participant(); const t = await team();
    await db.getRepository(TeamMember).save({ teamId: t.id, participantId: p.id });
    const session = await db.getRepository(RefreshToken).save({ token: randomUUID(), participantId: p.id, expiresAt: new Date(Date.now() + 60000) });
    await db.getRepository(Participant).update(p.id, { passwordHash: 'old-hash', firebaseUid: 'old-identity', passwordResetToken: 'old-reset', passwordResetExpires: new Date(Date.now() + 60000) });
    await db.getRepository(Participant).softDelete(p.id);
    const service = new ParticipantsService(db.getRepository(Participant), db.getRepository('ParticipantPreference') as any, db.getRepository(Cohort), {} as any, {} as any, config, {} as any);
    await service.create({ participantId: p.participantId, email: p.email, firstName: 'Restored', lastName: 'Participant', country: 'GH', cohortId: cohort.id });
    const [row] = await db.query('SELECT deleted_at, firebase_uid, password_reset_token, password_reset_expires, password_hash FROM participants WHERE id = $1', [p.id]);
    expect(row.deleted_at).toBeNull(); expect(row.firebase_uid).toBeNull(); expect(row.password_reset_token).toBeNull(); expect(row.password_reset_expires).toBeNull();
    expect(row.password_hash).not.toBe('old-hash');
    expect(await db.getRepository(TeamMember).countBy({ participantId: p.id })).toBe(0);
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: session.id })).isRevoked).toBe(true);
  });
  it('ranks a nonempty leaderboard using confirmed membership, stage filters, and zero weights', async () => {
    const c = await db.getRepository(Cohort).save({ name: 'Leaderboard cohort', status: CohortStatus.ACTIVE, leaderboardConfig: { isPublic: true, showScores: true } });
    const t = await db.getRepository(Team).save({ name: 'Ranked team', inviteCode: randomUUID(), cohortId: c.id, status: 'active' as any });
    const p = await db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + '@example.test', firstName: 'Ranked', lastName: 'Participant', country: 'GH', cohortId: c.id });
    await db.getRepository(TeamMember).save({ teamId: t.id, participantId: p.id });
    const a = await db.getRepository(Stage).save({ name: 'Zero weight', number: 1, cohortId: c.id, deadline: new Date('2030-01-01'), weightPercentage: 0 });
    const b = await db.getRepository(Stage).save({ name: 'Contributing', number: 2, cohortId: c.id, deadline: new Date('2030-01-01'), weightPercentage: 100 });
    await db.getRepository(Evaluation).save([{ teamId: t.id, stageId: a.id, cohortId: c.id, finalScore: 40, isPublished: true }, { teamId: t.id, stageId: b.id, cohortId: c.id, finalScore: 80, isPublished: true }]);
    const service = new LeaderboardService(db.getRepository(Team), db.getRepository(Participant), db.getRepository(Evaluation), db.getRepository(Stage), db.getRepository(Cohort), db.getRepository('Vertical') as any, db.getRepository('Brief') as any);
    const overall = await service.getLeaderboard({ cohortId: c.id, country: 'GH' });
    expect(overall.entries).toHaveLength(1); expect(overall.entries[0].finalScore).toBe(80);
    expect((await service.getLeaderboard({ cohortId: c.id, stageId: a.id })).entries[0].finalScore).toBe(40);
    await db.getRepository(Cohort).update(c.id, { leaderboardConfig: { isPublic: false } });
    expect((await service.getLeaderboard({ cohortId: c.id })).entries).toEqual([]);
  });
});
