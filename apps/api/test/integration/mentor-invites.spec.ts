import "reflect-metadata";
import { DataSource } from "typeorm";
import { randomUUID, createHash } from "crypto";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Mentor, MentorStatus, MentorAssignment, MentorSession, ScheduledSession, MentorPayment } from "@/database/entities/mentor.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { User, Role } from "@/database/entities/user.entity";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { VerificationCode, VerificationCodeType } from "@/database/entities/verification-code.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Organization } from "@/database/entities/organization.entity";
import { MentorsService } from "@/modules/mentors/mentors.service";
import { AuthService } from "@/auth/auth.service";
import { MagicLinkService } from "@/auth/magic-link.service";
import { JwtStrategy } from "@/auth/strategies/jwt.strategy";
import { PortalType } from "@/auth/dto/auth.dto";
import { MentorPortalController } from "@/modules/mentors/mentors.controller";
import { MentorInvitesService } from "@/modules/mentors/mentor-invites.service";
import { MentorInvitesProcessor } from "@/modules/mentors/mentor-invites.processor";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Imported mentor email corrections", () => {
  let db: DataSource;
  let cohort: Cohort;
  let service: MentorsService;
  let sockets: { revokePrincipal: jest.Mock };
  let email: { sendMentorWelcomeEmail: jest.Mock; sendMagicLinkCode: jest.Mock };
  const config = new ConfigService({ FRONTEND_URL: "https://portal.example.test/", jwt: { secret: "mentor-email-regression" } });
  const jwt = new JwtService({ secret: "mentor-email-regression" });

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize();
    await db.runMigrations();
    cohort = await db.getRepository(Cohort).save({ name: "Mentor email regression", status: CohortStatus.ACTIVE });
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(() => {
    sockets = { revokePrincipal: jest.fn() };
    email = { sendMentorWelcomeEmail: jest.fn(async () => true), sendMagicLinkCode: jest.fn(async () => undefined) };
    service = new MentorsService(db.getRepository(Mentor), db.getRepository(MentorAssignment), db.getRepository(MentorSession), db.getRepository(ScheduledSession), db.getRepository(MentorPayment), db.getRepository(Team), db.getRepository(Cohort), db.getRepository(User), db.getRepository(TeamMember), {} as any, {} as any, email as any, config, sockets as any);
  });
  const address = () => `${randomUUID()}@example.test`;
  async function fixture(status = MentorStatus.IMPORTED, withUser = true) {
    const mentor = await db.getRepository(Mentor).save({ email: address(), firstName: "Import", lastName: "Mentor", cohortId: cohort.id, status, firebaseUid: randomUUID() });
    const user = withUser ? await db.getRepository(User).save({ email: mentor.email, firstName: mentor.firstName, lastName: mentor.lastName, role: Role.MENTOR, isActive: true, firebaseUid: randomUUID(), passwordHash: "old-password-hash", passwordResetToken: randomUUID(), passwordResetExpires: new Date(Date.now() + 60000) }) : null;
    return { mentor, user: user! };
  }
  function auth() {
    return new AuthService(db.getRepository(User), db.getRepository(RefreshToken), db.getRepository(Participant), db.getRepository(Cohort), db.getRepository(Mentor), jwt, {} as any, config, sockets as any);
  }
  function magic() {
    return new MagicLinkService(db.getRepository(VerificationCode), db.getRepository(User), db.getRepository(Organization), db.getRepository(Mentor), auth(), config, email as any);
  }

  it("updates the mentor and linked user atomically, revokes old sessions and invalidates codes", async () => {
    const { mentor, user } = await fixture();
    const session = await db.getRepository(RefreshToken).save({ userId: user.id, token: randomUUID(), isRevoked: false, expiresAt: new Date(Date.now() + 60000) });
    const oldCode = await db.getRepository(VerificationCode).save({ email: user.email, userId: user.id, type: VerificationCodeType.MAGIC_LINK, portal: PortalType.MENTOR, code: createHash("sha256").update("123456").digest("hex"), expiresAt: new Date(Date.now() + 60000) });
    const newEmail = address();
    expect(await service.update(mentor.id, { email: ` ${newEmail.toUpperCase()} `, firstName: "Corrected" })).toMatchObject({ id: mentor.id, email: newEmail, firstName: "Corrected", status: MentorStatus.IMPORTED });
    const account = await db.getRepository(User).findOneOrFail({ where: { id: user.id }, select: { id: true, email: true, role: true, firebaseUid: true, passwordHash: true, passwordResetToken: true, passwordResetExpires: true } });
    expect(account).toMatchObject({ email: newEmail, role: Role.MENTOR, firebaseUid: null, passwordHash: null, passwordResetToken: null, passwordResetExpires: null });
    expect((await db.getRepository(Mentor).findOneByOrFail({ id: mentor.id })).firebaseUid).toBeNull();
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: session.id })).isRevoked).toBe(true);
    expect((await db.getRepository(VerificationCode).findOneByOrFail({ id: oldCode.id })).usedAt).not.toBeNull();
    expect(sockets.revokePrincipal).toHaveBeenCalledWith(user.id);
    await expect(magic().verifyCode(user.email, "123456")).rejects.toThrow("Invalid or expired code");
    await expect(new JwtStrategy(config, db).validate({ sub: user.id, sid: session.id, role: Role.MENTOR, iat: 1, exp: 9999999999 })).rejects.toThrow("Session has ended");
  });

  it("lets the corrected address request a fresh code and sign into the same mentor profile", async () => {
    const { mentor, user } = await fixture();
    const newEmail = address();
    await service.update(mentor.id, { email: newEmail });
    const login = magic();
    await login.sendMagicCode(user.email, PortalType.MENTOR);
    expect(email.sendMagicLinkCode).not.toHaveBeenCalled();
    await login.sendMagicCode(newEmail, PortalType.MENTOR);
    const issued = email.sendMagicLinkCode.mock.calls[0][0];
    expect(issued.to).toBe(newEmail);
    const response = await login.verifyCode(newEmail, issued.code);
    expect(response.user).toMatchObject({ id: user.id, email: newEmail, role: Role.MENTOR });
    expect((await new JwtStrategy(config, db).validate(jwt.verify(response.accessToken))).mentorId).toBe(mentor.id);
    expect((await db.getRepository(Mentor).findOneByOrFail({ id: mentor.id })).status).toBe(MentorStatus.ACTIVE);
  });

  it.each([MentorStatus.ACTIVE, MentorStatus.INACTIVE])("rejects %s email edits even with a simultaneous imported status", async status => {
    const { mentor, user } = await fixture(status);
    await expect(service.update(mentor.id, { email: address(), status: MentorStatus.IMPORTED })).rejects.toThrow("only be changed while the mentor is imported");
    expect(await db.getRepository(Mentor).findOneByOrFail({ id: mentor.id })).toMatchObject({ email: mentor.email, status });
    expect((await db.getRepository(User).findOneByOrFail({ id: user.id })).email).toBe(user.email);
  });

  it("rejects another mentor’s email and a conflicting staff login without changing either record", async () => {
    const { mentor, user } = await fixture();
    const other = await fixture();
    await expect(service.update(mentor.id, { email: other.mentor.email })).rejects.toThrow("mentor with this email already exists");
    const staff = await db.getRepository(User).save({ email: address(), role: Role.PROGRAM_MANAGER, isActive: true });
    await expect(service.update(mentor.id, { email: staff.email.toUpperCase(), firstName: "Must roll back" })).rejects.toThrow("already used by another account");
    expect(await db.getRepository(Mentor).findOneByOrFail({ id: mentor.id })).toMatchObject({ email: mentor.email, firstName: mentor.firstName });
    expect((await db.getRepository(User).findOneByOrFail({ id: user.id })).email).toBe(user.email);
    expect(sockets.revokePrincipal).not.toHaveBeenCalled();
  });

  it("creates a mentor login when correcting a legacy import with no linked user", async () => {
    const { mentor } = await fixture(MentorStatus.IMPORTED, false);
    const newEmail = address();
    await service.update(mentor.id, { email: newEmail });
    expect(await db.getRepository(User).findOneByOrFail({ email: newEmail })).toMatchObject({ role: Role.MENTOR, isActive: true });
    expect(await db.getRepository(User).findOneBy({ email: mentor.email })).toBeNull();
  });

  it("rolls back user, mentor and session changes if persistence fails", async () => {
    const { mentor, user } = await fixture();
    const session = await db.getRepository(RefreshToken).save({ userId: user.id, token: randomUUID(), isRevoked: false, expiresAt: new Date(Date.now() + 60000) });
    await expect(service.update(mentor.id, { email: address(), firstName: null as any })).rejects.toThrow();
    expect((await db.getRepository(User).findOneByOrFail({ id: user.id })).email).toBe(user.email);
    expect((await db.getRepository(Mentor).findOneByOrFail({ id: mentor.id })).email).toBe(mentor.email);
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: session.id })).isRevoked).toBe(false);
    expect(sockets.revokePrincipal).not.toHaveBeenCalled();
  });

  it("keeps the two emails consistent when first login races an imported email correction", async () => {
    for (let index = 0; index < 3; index++) {
      const { mentor, user } = await fixture();
      const results = await Promise.allSettled([service.update(mentor.id, { email: address() }), auth().generateTokens(user)]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const current = await db.getRepository(Mentor).findOneByOrFail({ id: mentor.id });
      const account = await db.getRepository(User).findOneByOrFail({ id: user.id });
      expect(current.email).toBe(account.email);
      expect(current.status).toBe(results[0].status === "fulfilled" ? MentorStatus.IMPORTED : MentorStatus.ACTIVE);
    }
  });

  it("resends the branded welcome email to the corrected imported mentor only", async () => {
    const { mentor } = await fixture();
    const corrected = address();
    await service.update(mentor.id, { email: corrected });
    await expect(service.resendInvite(mentor.id)).resolves.toMatchObject({ message: "Mentor invitation sent" });
    expect(email.sendMentorWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({ to: corrected, cohortName: cohort.name, portalUrl: "https://portal.example.test" }), true);
    await db.getRepository(Mentor).update(mentor.id, { status: MentorStatus.ACTIVE });
    await expect(service.resendInvite(mentor.id)).rejects.toThrow("only be resent to imported");
    expect(email.sendMentorWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("does not let mentor self-service change their email", async () => {
    const { mentor } = await fixture();
    const controller = new MentorPortalController(service, {} as any);
    expect(await controller.updateMyProfile({ email: mentor.email }, { email: address(), bio: "Updated bio" })).toMatchObject({ email: mentor.email, bio: "Updated bio" });
  });

  it("bulk selection excludes active, inactive, missing and soft-deleted mentors", async () => {
    const imported = await fixture(), active = await fixture(MentorStatus.ACTIVE), inactive = await fixture(MentorStatus.INACTIVE), deleted = await fixture();
    await db.getRepository(Mentor).softDelete(deleted.mentor.id);
    const queue = { add: jest.fn(async () => ({ id: randomUUID() })) };
    const bulk = new MentorInvitesService(db.getRepository(Mentor), queue as any, { requireDeliveryConfiguration: () => {} } as any);
    for (const invalid of [active.mentor.id, inactive.mentor.id, deleted.mentor.id, randomUUID()]) {
      await expect(bulk.resendSelected([imported.mentor.id, invalid], "manager")).rejects.toThrow("Only imported");
    }
    expect(queue.add).not.toHaveBeenCalled();
    expect(await bulk.resendSelected([imported.mentor.id], "manager")).toMatchObject({ total: 1 });
  });

  it("all-imported bulk queries apply cohort, search and both capacity states correctly", async () => {
    const marker = randomUUID();
    const available = await fixture(), full = await fixture(), active = await fixture(MentorStatus.ACTIVE), deleted = await fixture();
    const otherCohort = await db.getRepository(Cohort).save({ name: "Other batch cohort", status: CohortStatus.ACTIVE });
    const outside = await fixture();
    await db.getRepository(Mentor).update({ id: outside.mentor.id }, { cohortId: otherCohort.id, company: marker });
    for (const item of [available, full, active, deleted]) await db.getRepository(Mentor).update(item.mentor.id, { company: marker, maxTeams: 1 });
    await db.getRepository(Mentor).softDelete(deleted.mentor.id);
    const team = await db.getRepository(Team).save({ name: "Capacity batch team", cohortId: cohort.id, inviteCode: randomUUID() });
    await db.getRepository(MentorAssignment).save({ mentorId: full.mentor.id, teamId: team.id, isActive: true });
    const queue = { add: jest.fn(async (_name: string, _data: any) => ({ id: randomUUID() })) };
    const bulk = new MentorInvitesService(db.getRepository(Mentor), queue as any, { requireDeliveryConfiguration: () => {} } as any);
    await bulk.resendImported({ cohortId: cohort.id, search: marker, hasCapacity: true }, "manager");
    expect(queue.add.mock.calls[0][1].mentorIds).toEqual([available.mentor.id]);
    await bulk.resendImported({ cohortId: cohort.id, search: marker, hasCapacity: false }, "manager");
    expect(queue.add.mock.calls[1][1].mentorIds).toEqual([full.mentor.id]);
    expect(await bulk.resendImported({ cohortId: cohort.id, search: marker }, "manager")).toMatchObject({ total: 2 });
  });

  it("bulk delivery uses a corrected email and skips a mentor activated after queuing", async () => {
    const { mentor } = await fixture();
    const corrected = address();
    await service.update(mentor.id, { email: corrected });
    const worker = new MentorInvitesProcessor(db.getRepository(Mentor), service);
    const job = { data: { mentorIds: [mentor.id], requestedBy: "manager" }, progress: 0, updateProgress: jest.fn() } as any;
    expect(await worker.process(job)).toMatchObject({ sent: 1, skipped: 0 });
    expect(email.sendMentorWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({ to: corrected }), true);
    await db.getRepository(Mentor).update(mentor.id, { status: MentorStatus.ACTIVE });
    expect(await worker.process(job)).toMatchObject({ sent: 0, skipped: 1 });
    expect(email.sendMentorWelcomeEmail).toHaveBeenCalledTimes(1);
  });
});
