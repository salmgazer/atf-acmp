import { Stage } from "@/database/entities/stage.entity";
import { CohortsService } from "@/modules/cohorts/cohorts.service";
import { validateCohortDeadlineStages } from "@/common/services/cohort-team-deadlines";
import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Logger } from "@nestjs/common";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Team, TeamMember, TeamMemberStatus, TeamRole, TeamStatus, TeamInvitation, InvitationStatus } from "@/database/entities/team.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Organization } from "@/database/entities/organization.entity";
import { TeamsService } from "@/modules/teams/teams.service";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { ParticipantImportService } from "@/modules/participants/participant-import.service";
import { TeamFormationService } from "@/modules/matching/team-formation.service";
import { assertChallengeStarted } from "@/common/services/team-rules";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("ATF team lifecycle and formation with PostgreSQL", () => {
  let db: DataSource, cohort: Cohort, actor: User, teams: TeamsService, participants: ParticipantsService, formation: TeamFormationService, effects: any, sessions: { revokePrincipal: jest.Mock };
  const cache = new Map<string, unknown>();
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost", "postgres"].includes(url.hostname)) throw new Error("Disposable local regression database required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    const join = new Date(Date.now() + 7 * 86400000).toISOString(), certificate = new Date(Date.now() + 21 * 86400000).toISOString();
    cohort = await db.getRepository(Cohort).save({ name: "ATF rules " + randomUUID(), status: CohortStatus.ACTIVE, groups: ["A", "B"], countries: ["GH", "NG"], teamSizeMin: 3, teamSizeMax: 5, deadlines: { teamFormationEnd: join, learningCertificationEnd: certificate } as any });
    const joiningStage = await db.getRepository(Stage).save({ cohortId: cohort.id, number: 1, name: "Team joining", deadline: new Date(join) });
    const certificationStage = await db.getRepository(Stage).save({ cohortId: cohort.id, number: 2, name: "Learning certification", deadline: new Date(certificate) });
    await db.getRepository(Cohort).update(cohort.id, { teamJoiningStageId: joiningStage.id, learningCertificationStageId: certificationStage.id });
    Object.assign(cohort, { teamJoiningStageId: joiningStage.id, learningCertificationStageId: certificationStage.id });
    actor = await db.getRepository(User).save({ email: randomUUID() + "@example.test", role: Role.PROGRAM_MANAGER });
    effects = new Proxy({}, { get: () => jest.fn(async () => undefined) });
    teams = Object.assign(Object.create(TeamsService.prototype), { logger: new Logger("ATF test"), teamRepository: db.getRepository(Team), memberRepository: db.getRepository(TeamMember), invitationRepository: db.getRepository(TeamInvitation), removalRequestRepository: db.getRepository("TeamMemberRemovalRequest"), participantRepository: db.getRepository(Participant), cohortRepository: db.getRepository(Cohort), briefRepository: db.getRepository(Brief), chatChannelRepository: db.getRepository("ChatChannel"), channelMemberRepository: db.getRepository("ChannelMember"), userRepository: db.getRepository(User), oneSignalService: effects, notificationTriggersService: effects, emailService: effects });
    sessions = { revokePrincipal: jest.fn() };
    participants = new ParticipantsService(db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Cohort), effects, effects, {} as any, effects, sessions as any);
    cache.clear();
    formation = new TeamFormationService({ get: async (key: string) => cache.get(key), set: async (key: string, value: unknown) => { cache.set(key, value); }, del: async (key: string) => { cache.delete(key); } } as any, db.getRepository(Team), db.getRepository(TeamMember), db.getRepository(Cohort), db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Brief), db.getRepository("Vertical") as any, effects, effects);
    jest.spyOn(formation as any, "sendTeamFormationNotifications").mockResolvedValue(undefined);
  });
  async function person(values: Partial<Participant> = {}, preference: Partial<ParticipantPreference> = {}) {
    const p = await db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", firstName: "Example", lastName: "Learner", country: "Ghana", cohortId: cohort.id, group: "A", status: ParticipantStatus.READY, onboardingComplete: true, mustChangePassword: false, learningHalfwayReached: true, learningCertificateIssued: false, learningFinishedAllLessons: false, pythonSkill: "Beginner", fieldOfStudy: "Computer Science", ...values });
    await db.getRepository(ParticipantPreference).save({ participantId: p.id, buildDeployAbility: "with_support", firstChoiceSector: "health", backupSector: "education", preferredRole: "sector_specialist", teamStatus: "need_team", matchingProfileCompletedAt: new Date(), crossCountryWilling: false, matchingProfileConsent: true, ...preference }); return p;
  }
  const builder = () => person({ pythonSkill: "Intermediate" }, { buildDeployAbility: "confident", preferredRole: "builder" });
  async function roster() {
    const lead = await builder(), specialist = await person({ fieldOfStudy: "Medicine" }), impact = await person({ fieldOfStudy: "Law" }, { preferredRole: "business_impact_lead" });
    const team = await teams.create({ name: "Draft ATF team", cohortId: cohort.id, creatorId: lead.id });
    await teams.addMember(team.id, { participantId: specialist.id }); await teams.addMember(team.id, { participantId: impact.id });
    return { team, lead, specialist, impact, members: [lead, specialist, impact] };
  }
  async function brief(country = "Ghana") {
    const org = await db.getRepository(Organization).save({ name: "Example partner", email: randomUUID() + "@example.test", cohortId: cohort.id, country, status: "approved" as any });
    return db.getRepository(Brief).save({ title: "Approved practice problem", description: "A useful practice challenge description", problemStatement: "A useful practice problem to solve", expectedOutcomes: "A useful working application", cohortId: cohort.id, organizationId: org.id, problemCountry: country, status: BriefStatus.APPROVED, maxTeams: 50 });
  }
  async function certify(members: Participant[]) { for (const p of members) await db.getRepository(Participant).update(p.id, { learningCertificateIssued: true, learningFinishedAllLessons: true, learningCertificateId: randomUUID(), learningCertificateDate: new Date().toISOString().slice(0, 10) }); }

  it("keeps drafts unregistered, registers valid teams and assigns briefs without starting; all members must be certified to start", async () => {
    const lead = await builder(), team = await teams.create({ name: "Draft", cohortId: cohort.id, creatorId: lead.id });
    expect(team).toMatchObject({ status: TeamStatus.FORMING, registeredAt: null, challengeStartedAt: null, group: "A" });
    await expect(teams.registerTeam(team.id, "Ghana")).rejects.toThrow("3 to 5");
    const nonComputing = await person({ fieldOfStudy: "Medicine" }), other = await person();
    await teams.addMember(team.id, { participantId: nonComputing.id }); await teams.addMember(team.id, { participantId: other.id });
    const registered = await teams.registerTeam(team.id, "GH"); expect(registered.registeredAt).toBeInstanceOf(Date);
    const problem = await brief(); const assigned = await teams.assignBrief(team.id, problem.id);
    expect(assigned.status).toBe(TeamStatus.FORMING); expect(assigned.registeredAt).toEqual(registered.registeredAt);
    await expect(teams.startChallenge(team.id)).rejects.toThrow("40 lessons");
    await certify([lead, nonComputing, other]); const active = await teams.startChallenge(team.id);
    expect(active).toMatchObject({ status: TeamStatus.ACTIVE, challengeStartedAt: expect.any(Date) });
    await expect(assertChallengeStarted(db.manager, team.id)).resolves.toBeUndefined();
    await db.getRepository(Participant).update(other.id, { learningCertificateIssued: false });
    await expect(assertChallengeStarted(db.manager, team.id)).rejects.toThrow("certificate checks");
  });

  it("requires builder and non-computing coverage, a resident competition country and a problem based in that country", async () => {
    const { team, lead, members } = await roster();
    await expect(teams.registerTeam(team.id, "Kenya")).rejects.toThrow("where at least one member lives");
    await db.getRepository(Participant).update(lead.id, { pythonSkill: "Beginner" });
    await expect(teams.registerTeam(team.id, "Ghana")).rejects.toThrow("qualified builder");
    await participants.updateProgrammeStatus(lead.id, { codeLabsCompleted: true }, actor.id);
    expect((await teams.registerTeam(team.id, "Ghana")).registeredAt).toBeTruthy();
    const wrong = await brief("Nigeria"); await expect(teams.assignBrief(team.id, wrong.id)).rejects.toThrow("problem country");
    for (const p of members) await db.getRepository(Participant).update(p.id, { fieldOfStudy: "Computer Science" });
    await expect(teams.registerTeam(team.id, "Ghana")).rejects.toThrow("field of study");
  });

  it("enforces current eligibility for creation, staff additions, join codes, invitations and pending confirmations", async () => {
    const invalid = await person({ learningHalfwayReached: false });
    await expect(teams.create({ name: "Invalid", cohortId: cohort.id, creatorId: invalid.id })).rejects.toThrow("20 of the 40");
    const { team, lead } = await roster();
    await expect(teams.addMember(team.id, { participantId: invalid.id })).rejects.toThrow("20 of the 40");
    await expect(teams.joinByInviteCode(team.inviteCode, invalid.id)).rejects.toThrow("20 of the 40");
    await expect(teams.sendInvitation(team.id, { participantId: invalid.id, invitedBy: lead.id })).rejects.toThrow("20 of the 40");
    const valid = await person(); await teams.joinByInviteCode(team.inviteCode, valid.id);
    const pending = await db.getRepository(TeamMember).findOneByOrFail({ teamId: team.id, participantId: valid.id });
    await db.getRepository(Participant).update(valid.id, { learningHalfwayReached: false });
    await expect(teams.confirmPendingMember(team.id, pending.id, lead.id)).rejects.toThrow("20 of the 40");
    expect((await db.getRepository(TeamMember).findOneByOrFail({ id: pending.id })).status).toBe(TeamMemberStatus.PENDING);
  });

  it("withdraws only pending requests without changing confirmed teams, then permits a new request", async () => {
    const lead = await builder(), applicant = await person(), team = await teams.create({ name: "Request lifecycle", cohortId: cohort.id, creatorId: lead.id });
    await teams.joinByInviteCode(team.inviteCode, applicant.id);
    expect((await teams.findParticipantTeam(applicant.id))?.id).toBe(team.id);
    await teams.withdrawJoinRequest(team.id, applicant.id);
    expect(await teams.findParticipantTeam(applicant.id)).toBeNull();
    expect(await db.getRepository(TeamMember).countBy({ teamId: team.id, participantId: lead.id, status: TeamMemberStatus.CONFIRMED })).toBe(1);
    expect((await db.getRepository(Participant).findOneByOrFail({ id: applicant.id })).status).toBe(ParticipantStatus.READY);
    await expect(teams.withdrawJoinRequest(team.id, lead.id)).rejects.toThrow("already approved or withdrawn");
    await teams.joinByInviteCode(team.inviteCode, applicant.id);
    const pending = await db.getRepository(TeamMember).findOneByOrFail({ teamId: team.id, participantId: applicant.id });
    await teams.confirmPendingMember(team.id, pending.id, lead.id);
    await expect(teams.withdrawJoinRequest(team.id, applicant.id)).rejects.toThrow("already approved or withdrawn");
    expect(await db.getRepository(TeamMember).countBy({ teamId: team.id, participantId: applicant.id, status: TeamMemberStatus.CONFIRMED })).toBe(1);
  });

  it("requires everyone's cross-country consent, including when accepting an old invitation", async () => {
    const { team, lead, members } = await roster();
    const foreign = await person({ country: "Nigeria" }, { crossCountryWilling: true });
    await expect(teams.addMember(team.id, { participantId: foreign.id })).rejects.toThrow("every member");
    await expect(teams.joinByInviteCode(team.inviteCode, foreign.id)).rejects.toThrow("every member");
    const invitation = await db.getRepository(TeamInvitation).save({ teamId: team.id, participantId: foreign.id, invitedBy: lead.id, status: InvitationStatus.PENDING });
    await expect(teams.acceptInvitation(invitation.id)).rejects.toThrow("every member");
    for (const p of members) await db.getRepository(ParticipantPreference).update({ participantId: p.id }, { crossCountryWilling: true });
    await expect(teams.acceptInvitation(invitation.id)).resolves.toBeDefined();
  });

  it("closes every admission path at the joining deadline while letting a timely registered, certified team start afterward", async () => {
    const { team, lead, members } = await roster(); await teams.registerTeam(team.id, "Ghana");
    const problem = await brief(); await teams.assignBrief(team.id, problem.id); await certify(members);
    const extra = await person(); const invitation = await db.getRepository(TeamInvitation).save({ teamId: team.id, participantId: extra.id, invitedBy: lead.id });
    await db.getRepository(Stage).update(cohort.teamJoiningStageId!, { deadline: new Date(Date.now() - 1000) });
    for (const operation of [() => teams.addMember(team.id, { participantId: extra.id }), () => teams.joinByInviteCode(team.inviteCode, extra.id), () => teams.acceptInvitation(invitation.id), () => teams.registerTeam(team.id, "Ghana")]) await expect(operation()).rejects.toThrow("deadline");
    await expect(teams.startChallenge(team.id)).resolves.toMatchObject({ status: TeamStatus.ACTIVE });
  });

  it("removes an opted-out lead, promotes a remaining member, revokes chat access and invalidates registration without removing teammates", async () => {
    const { team, lead } = await roster(); await teams.registerTeam(team.id, "Ghana");
    const session = await db.getRepository(RefreshToken).save({ token: randomUUID(), participantId: lead.id, expiresAt: new Date(Date.now() + 86400000) });
    await participants.updateProgrammeStatus(lead.id, { programmeOptedOut: true, reason: "ATF opt-outs list" }, actor.id);
    expect(await db.getRepository(TeamMember).countBy({ participantId: lead.id })).toBe(0);
    expect(await db.getRepository(RefreshToken).findOneByOrFail({ id: session.id })).toMatchObject({ isRevoked: true, revokedReason: "Programme opt-out" });
    expect(sessions.revokePrincipal).toHaveBeenCalledWith(lead.id);
    const remaining = await db.getRepository(TeamMember).findBy({ teamId: team.id }); expect(remaining).toHaveLength(2); expect(remaining.filter(m => m.role === TeamRole.LEAD)).toHaveLength(1);
    expect(await db.getRepository(Team).findOneByOrFail({ id: team.id })).toMatchObject({ registeredAt: null, challengeStartedAt: null, status: TeamStatus.FORMING });
    const chat = await db.getRepository("ChannelMember").findOneByOrFail({ memberId: lead.id }); expect(chat.leftAt).toBeInstanceOf(Date);
    await expect(db.getRepository(TeamMember).save({ teamId: team.id, participantId: lead.id })).rejects.toThrow("Opted-out");
    await participants.updateProgrammeStatus(lead.id, { programmeOptedOut: false }, actor.id);
    expect(await db.getRepository(TeamMember).countBy({ participantId: lead.id })).toBe(0); expect((await db.getRepository(Participant).findOneByOrFail({ id: lead.id })).status).toBe(ParticipantStatus.INACTIVE);
  });

  it("applies reviewed opt-outs from an update-only CSV atomically with roster removal", async () => {
    const { team, lead } = await roster();
    const imports = new ParticipantImportService(db, { add: async () => ({}), setGlobalConcurrency: async () => {} } as any, effects);
    const input = { cohortId: cohort.id, sourceName: "opt-outs.csv", mode: "update_only" as const, csv: `participant_id,opt_out\n${lead.participantId},Yes`, updateFields: ["programmeOptedOut" as const], sendWelcomeEmail: false };
    const preview = await imports.preview(input, actor); expect(preview.ready).toBe(true);
    const batch = await imports.enqueue({ ...input, previewHash: preview.previewHash }, actor); await imports.process(batch.id);
    expect(await imports.status(batch.id, actor)).toMatchObject({ state: "completed", result: { affectedTeamIds: [team.id] } });
    expect(await db.getRepository(TeamMember).countBy({ participantId: lead.id })).toBe(0);
  });

  it("previews ordered valid teams and finalizes them registered but unstarted, with no automatic challenge activation", async () => {
    for (let index = 0; index < 2; index++) { await builder(); await person({ fieldOfStudy: "Medicine" }); await person(); }
    const preview = await formation.runTeamFormation(cohort.id); expect(preview.proposedTeams).toHaveLength(2);
    for (const team of preview.proposedTeams) expect(team.eligibility?.canRegister).toBe(true);
    expect((await formation.finalizeTeamFormation(cohort.id)).createdTeamCount).toBe(2);
    const found = await db.getRepository(Team).findBy({ cohortId: cohort.id });
    expect(found).toHaveLength(2); expect(found.every(t => t.registeredAt && !t.challengeStartedAt && t.status === TeamStatus.FORMING)).toBe(true);
  });

  it("revalidates a stale formation preview and rolls back every team if one member opts out", async () => {
    const people = [await builder(), await person({ fieldOfStudy: "Medicine" }), await person()];
    await formation.runTeamFormation(cohort.id);
    await participants.updateProgrammeStatus(people[1].id, { programmeOptedOut: true }, actor.id);
    await expect(formation.finalizeTeamFormation(cohort.id)).rejects.toThrow("changed");
    expect(await db.getRepository(Team).countBy({ cohortId: cohort.id })).toBe(0);
    expect((formation as any).sendTeamFormationNotifications).not.toHaveBeenCalled();
  });

  it("cannot bypass rules through status changes, force-cross-country options or duplicate manual overrides", async () => {
    const { team } = await roster(); await expect(teams.updateStatus(team.id, TeamStatus.ACTIVE)).rejects.toThrow("Start challenge");
    await expect(formation.runTeamFormation(cohort.id, { config: { forceCrossCountry: true } })).rejects.toThrow("cannot be overridden");
    const extra = [await builder(), await person({ fieldOfStudy: "Law" }), await person()];
    await formation.runTeamFormation(cohort.id);
    await expect(formation.finalizeTeamFormation(cohort.id, { manualTeams: [{ participantIds: [extra[0].id, extra[0].id, extra[1].id] }] })).rejects.toThrow("unique");
  });
  it("uses only selected cohort stages, keeps closed-stage deadlines and ignores stale JSON date copies", async () => {
    const { team } = await roster();
    await db.getRepository(Cohort).update(cohort.id, { teamJoiningStageId: null, deadlines: { teamFormationEnd: "2099-01-01T00:00:00Z" } as any });
    expect(await teams.eligibility(team.id)).toMatchObject({ joinDeadline: null, canRegister: false });
    await expect(teams.registerTeam(team.id, "Ghana")).rejects.toThrow("team-joining deadline stage");
    await db.getRepository(Cohort).update(cohort.id, { teamJoiningStageId: cohort.teamJoiningStageId });
    await db.getRepository(Stage).update(cohort.teamJoiningStageId!, { isActive: false });
    expect((await teams.eligibility(team.id)).joinDeadline).not.toBeNull();
    await db.getRepository(Stage).update(cohort.teamJoiningStageId!, { isActive: true });
    const live = await teams.eligibility(team.id);
    expect(live.joinDeadline).not.toBe("2099-01-01T00:00:00Z");
    await db.getRepository(Stage).remove(await db.getRepository(Stage).findOneByOrFail({ id: cohort.learningCertificationStageId! }));
    expect(await teams.eligibility(team.id)).toMatchObject({ certificateDeadline: null, canStartChallenge: false });
  });

  it("invalidates automatic formation previews when a selected stage date changes without changing the cohort row", async () => {
    await builder(); await person({ fieldOfStudy: "Medicine" }); await person();
    await formation.runTeamFormation(cohort.id);
    const before = await db.getRepository(Cohort).findOneByOrFail({ id: cohort.id });
    await db.getRepository(Stage).update(cohort.teamJoiningStageId!, { deadline: new Date(Date.now() + 8 * 86400000) });
    const after = await db.getRepository(Cohort).findOneByOrFail({ id: cohort.id });
    expect(after.updatedAt).toEqual(before.updatedAt);
    await expect(formation.finalizeTeamFormation(cohort.id)).rejects.toThrow("stage deadlines changed");
    expect(await db.getRepository(Team).countBy({ cohortId: cohort.id })).toBe(0);
  });

  it("validates deadline stage ownership and order, and returns live stage dates without mutating cached cohort data", async () => {
    const other = await db.getRepository(Cohort).save({ name: "Other cohort", status: CohortStatus.ACTIVE });
    const foreign = await db.getRepository(Stage).save({ cohortId: other.id, number: 1, name: "Foreign deadline", deadline: new Date(Date.now() + 86400000) });
    await expect(validateCohortDeadlineStages(db.manager, Object.assign(new Cohort(), cohort, { teamJoiningStageId: foreign.id }))).rejects.toThrow("belonging to this cohort");
    await expect(validateCohortDeadlineStages(db.manager, Object.assign(new Cohort(), cohort, { teamJoiningStageId: cohort.learningCertificationStageId, learningCertificationStageId: cohort.teamJoiningStageId }))).rejects.toThrow("cannot precede");
    const service = Object.assign(Object.create(CohortsService.prototype), { cohortRepository: db.getRepository(Cohort) }) as CohortsService;
    const original = JSON.stringify(cohort.deadlines), cached = { ...cohort, stageCount: 2 };
    const deadline = new Date("2033-08-12T17:45:00Z"); await db.getRepository(Stage).update(cohort.teamJoiningStageId!, { deadline });
    const response = await service.withTeamDeadlineView(cached);
    expect(response.deadlines.teamFormationEnd).toBe(deadline.toISOString()); expect(JSON.stringify(cohort.deadlines)).toBe(original);
    await db.transaction(async manager => {
      await manager.query("SET LOCAL TIME ZONE 'America/New_York'");
      expect((await manager.findOneByOrFail(Stage, { id: cohort.teamJoiningStageId! })).deadline.toISOString()).toBe(deadline.toISOString());
    });
  });

});
