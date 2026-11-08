import { Stage } from "@/database/entities/stage.entity";
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import { Cohort } from '@/database/entities/cohort.entity';
import { Participant } from '@/database/entities/participant.entity';
import { Team, TeamMember, TeamMemberStatus, TeamRole, TeamInvitation, InvitationStatus } from '@/database/entities/team.entity';
import { ParticipantsService } from '@/modules/participants/participants.service';
import { TeamsService } from '@/modules/teams/teams.service';

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)('Cohort groups in PostgreSQL', () => {
  let db: DataSource;
  let cohort: Cohort;
  let participants: ParticipantsService;
  let teams: TeamsService;
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) throw new Error('A disposable local regression database is required');
    db = new DataSource({ type: 'postgres', url: databaseUrl, entities: [path.join(__dirname, '../../src/database/entities/*.entity.ts')], migrations: [path.join(__dirname, '../../src/database/migrations/*.ts')], synchronize: false });
    await db.initialize();
    await db.runMigrations();
    cohort = await db.getRepository(Cohort).save({ name: 'Groups regression', groups: ['North', 'South'], teamSizeMax: 5, status: "active" as any });
    await configureStages(cohort);
    participants = new ParticipantsService(db.getRepository(Participant), db.getRepository('ParticipantPreference') as any, db.getRepository(Cohort), {} as any, {} as any, new ConfigService(), {} as any);
    teams = Object.assign(Object.create(TeamsService.prototype), {
      logger: new Logger('Groups regression'),
      teamRepository: db.getRepository(Team), memberRepository: db.getRepository(TeamMember), invitationRepository: db.getRepository(TeamInvitation), participantRepository: db.getRepository(Participant), cohortRepository: db.getRepository(Cohort), chatChannelRepository: db.getRepository('ChatChannel'), channelMemberRepository: db.getRepository('ChannelMember'),
    });
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  async function configureStages(c: Cohort) {
    const joining = await db.getRepository(Stage).save({ cohortId: c.id, number: 91, name: "Team joining", deadline: new Date(Date.now() + 7 * 86400000) });
    const certification = await db.getRepository(Stage).save({ cohortId: c.id, number: 92, name: "Learning certification", deadline: new Date(Date.now() + 21 * 86400000) });
    await db.getRepository(Cohort).update(c.id, { teamJoiningStageId: joining.id, learningCertificationStageId: certification.id });
    Object.assign(c, { teamJoiningStageId: joining.id, learningCertificationStageId: certification.id });
  }
  function row() { const id = randomUUID(); return { participantId: id, email: id + '@example.test', firstName: 'Group', lastName: 'Test', country: 'GH' }; }
  async function person(group: string | null, targetCohort = cohort) {
    const p = await db.getRepository(Participant).save({ ...row(), cohortId: targetCohort.id, group, onboardingComplete: true, learningHalfwayReached: true });
    await db.getRepository("ParticipantPreference").save({ participantId: p.id, matchingProfileCompletedAt: new Date() }); return p;
  }
  async function team(group: string) { return db.getRepository(Team).save({ name: randomUUID(), inviteCode: randomUUID(), cohortId: cohort.id, group }); }

  it('requires a cohort group for single creation and bulk import before saving any row', async () => {
    const data = row();
    await expect(participants.create({ ...data, cohortId: cohort.id })).rejects.toThrow('Select a group');
    for (const group of [undefined, 'Foreign']) await expect(participants.bulkImport({ cohortId: cohort.id, group, participants: [data], sendWelcomeEmail: false })).rejects.toThrow('Select a group');
    expect(await db.getRepository(Participant).countBy({ email: data.email })).toBe(0);
  });
  it('assigns every imported participant the selected canonical group and filters by it', async () => {
    const rows = [row(), row()];
    const result = await participants.bulkImport({ cohortId: cohort.id, group: ' north ', participants: rows, sendWelcomeEmail: false });
    expect(result.successCount).toBe(2);
    const found = await participants.findAll({ cohortId: cohort.id, group: 'North' });
    expect(found.data.map(p => p.email)).toEqual(expect.arrayContaining(rows.map(p => p.email)));
    expect(found.data.every(p => p.group === 'North')).toBe(true);
    expect((await participants.findAll({ cohortId: cohort.id, ungrouped: true })).total).toBe(0);
  });
  it('inherits the manual team lead group and filters teams by group', async () => {
    const lead = await person('South');
    const created = await teams.create({ name: 'Manual grouped team', cohortId: cohort.id, creatorId: lead.id });
    expect(created.group).toBe('South');
    expect(created.members[0].participantId).toBe(lead.id);
    expect((await teams.findAll({ cohortId: cohort.id, group: 'North' })).data.some(t => t.id === created.id)).toBe(false);
    expect((await teams.findAll({ cohortId: cohort.id, group: 'South' })).data.some(t => t.id === created.id)).toBe(true);
  });
  it('rejects cross-group staff additions, self-joining and invitations before writing', async () => {
    const t = await team('North'), p = await person('South');
    const lead = await person('North');
    await db.getRepository(TeamMember).save({ teamId: t.id, participantId: lead.id, role: TeamRole.LEAD });
    await expect(teams.addMember(t.id, { participantId: p.id })).rejects.toThrow('same group');
    await expect(teams.joinByInviteCode(t.inviteCode, p.id)).rejects.toThrow('same group');
    await expect(teams.sendInvitation(t.id, { participantId: p.id, invitedBy: lead.id })).rejects.toThrow('same group');
    expect(await db.getRepository(TeamMember).countBy({ participantId: p.id })).toBe(0);
  });
  it.each([TeamMemberStatus.PENDING, TeamMemberStatus.CONFIRMED])('rejects direct cross-group %s memberships and permits the same group', async status => {
    const t = await team('North'), wrong = await person('South'), same = await person('North');
    await expect(db.getRepository(TeamMember).save({ teamId: t.id, participantId: wrong.id, status })).rejects.toThrow('same assigned group');
    await expect(db.getRepository(TeamMember).save({ teamId: t.id, participantId: same.id, status })).resolves.toBeDefined();
    await expect(participants.assignGroup(same.id, 'South')).rejects.toThrow('Remove the participant');
    await expect(db.getRepository(Participant).update(same.id, { group: 'South' })).rejects.toThrow('Remove the participant');
    await expect(db.getRepository(Team).update(t.id, { group: 'South' })).rejects.toThrow('share the team group');
  });
  it('rejects stale invitations after a participant changes group without accepting them', async () => {
    const t = await team('North'), lead = await person('North'), p = await person('North');
    const invitation = await db.getRepository(TeamInvitation).save({ teamId: t.id, participantId: p.id, invitedBy: lead.id });
    await participants.assignGroup(p.id, 'South');
    await expect(teams.acceptInvitation(invitation.id)).rejects.toThrow('same group');
    expect((await db.getRepository(TeamInvitation).findOneByOrFail({ id: invitation.id })).status).toBe(InvitationStatus.PENDING);
    expect(await db.getRepository(TeamMember).countBy({ participantId: p.id })).toBe(0);
  });
  it('prevents removal of assigned tags and invalid participant or team tags', async () => {
    await person('South');
    await expect(db.getRepository(Cohort).update(cohort.id, { groups: ['North'] })).rejects.toThrow('cannot be removed');
    await expect(person('Foreign')).rejects.toThrow('belong to their cohort');
    await expect(team('Foreign')).rejects.toThrow('belong to its cohort');
    await expect(db.getRepository(Participant).save({ ...row(), cohortId: cohort.id })).rejects.toThrow('group is required');
    await expect(db.getRepository(Team).save({ name: randomUUID(), inviteCode: randomUUID(), cohortId: cohort.id })).rejects.toThrow('Team group');
  });
  it('lets staff assign legacy ungrouped participants before team formation', async () => {
    const c = await db.getRepository(Cohort).save({ name: 'Legacy cohort', status: 'active' as any });
    await configureStages(c);
    const p = await person(null, c);
    await db.getRepository(Cohort).update(c.id, { groups: ['North'] });
    await expect(teams.create({ name: 'Missing group', cohortId: c.id, creatorId: p.id })).rejects.toThrow('Select a group');
    expect((await participants.assignGroup(p.id, 'North')).group).toBe('North');
    expect((await teams.create({ name: 'Assigned group', cohortId: c.id, creatorId: p.id })).group).toBe('North');
  });
  it('restores an imported participant into the newly selected group', async () => {
    const p = await person('North');
    await db.getRepository(Participant).softDelete(p.id);
    const result = await participants.bulkImport({ cohortId: cohort.id, group: 'South', participants: [{ ...row(), participantId: p.participantId, email: p.email }], sendWelcomeEmail: false });
    expect(result.successCount).toBe(1);
    expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).group).toBe('South');
  });
});
