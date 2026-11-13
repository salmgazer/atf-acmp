import "reflect-metadata";
import { DataSource, Repository } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Team, TeamMember, TeamRole, TeamMemberStatus } from "@/database/entities/team.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { TeamsService } from "@/modules/teams/teams.service";
import { CompleteOnboardingDto } from "@/modules/participants/dto/participant.dto";
import { canShareTeam, MATCHING_CONSENT_VERSION } from "@acmp/shared";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Participant matching onboarding", () => {
  let db: DataSource, cohort: Cohort, service: ParticipantsService;
  let notifications: { create: jest.Mock }, forums: { addParticipantToForumChannels: jest.Mock };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("Disposable local regression database required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    cohort = await db.getRepository(Cohort).save({ name: "Matching onboarding " + randomUUID(), status: CohortStatus.ACTIVE, countries: ["GH", "NG"], groups: ["Batch 1"] });
    notifications = { create: jest.fn() }; forums = { addParticipantToForumChannels: jest.fn() };
    service = new ParticipantsService(db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Cohort), notifications as any, {} as any, {} as any, forums as any);
  });
  const participant = (values: Partial<Participant> = {}) => db.getRepository(Participant).save({ participantId: randomUUID(), firstName: "Imported", lastName: "Learner", email: randomUUID() + "@example.test", lmsEmail: "lms-" + randomUUID() + "@example.test", country: "Ghana", cohortId: cohort.id, group: "Batch 1", institution: "Imported institution", pythonSkill: "Intermediate", githubUsername: "old-username", learningHalfwayReached: true, learningCertificateIssued: true, learningCertificateId: randomUUID(), learningCertificateDate: "2026-11-06", learningFinishedAllLessons: true, mustChangePassword: false, onboardingComplete: false, status: ParticipantStatus.ACTIVE, passwordHash: "preserved-hash", ...values });
  const input = (values: Partial<CompleteOnboardingDto> = {}): CompleteOnboardingDto => ({ profile: { firstName: "Confirmed", lastName: "Learner", country: "GH", institution: "Confirmed institution", phoneNumber: "+233200000001", whatsappNumber: "+233200000002", city: "Accra", locationType: "Urban", gender: "Female", educationLevel: "Bachelor's", currentAffiliation: "Graduate", fieldOfStudy: "Education", pythonSkill: "Intermediate", gitSkill: "Basic", aiExperience: "Self-taught", githubAccountStatus: "has_account", githubUsername: "confirmed-user" }, skills: { skills: [], interests: [] }, preferences: { briefRankings: [], crossCountryWilling: false, preferredRole: "sector_specialist", buildDeployAbility: "with_support", firstChoiceSector: "education", backupSector: "health", teamStatus: "need_team", matchingProfileConsent: false }, ...values });

  it("confirms the source profile and all matching answers atomically while preserving credentials, grouping and authoritative learning data", async () => {
    const p = await participant(); const dto = input();
    Object.assign(dto.profile, { learningCertificateId: "injected", learningCertificateIssued: false, email: "injected@example.test", group: "Other" });
    const completed = await service.completeOnboarding(p.id, dto);
    expect(completed).toMatchObject({ firstName: "Confirmed", country: "Ghana", githubUsername: "confirmed-user", githubAccountStatus: "has_account", profileConfirmedAt: expect.any(Date), learningCertificateIssued: true, learningCertificateId: p.learningCertificateId, email: p.email, group: "Batch 1", onboardingComplete: true, status: ParticipantStatus.READY });
    const credentials = await db.getRepository(Participant).findOneOrFail({ where: { id: p.id }, select: { passwordHash: true } });
    expect(credentials.passwordHash).toBe("preserved-hash");
    expect(completed.preference).toMatchObject({ preferredRole: "sector_specialist", firstChoiceSector: "education", backupSector: "health", buildDeployAbility: "with_support", teamStatus: "need_team", crossCountryWilling: false, matchingProfileConsent: false, matchingProfileConsentAt: expect.any(Date), matchingProfileCompletedAt: expect.any(Date), matchingProfileConsentVersion: MATCHING_CONSENT_VERSION });
    expect(notifications.create).toHaveBeenCalledTimes(1); expect(forums.addParticipantToForumChannels).toHaveBeenCalledTimes(1);
  });

  it("allows halfway learners with no certificate or GitHub account to complete and preserves existing team membership/status", async () => {
    const p = await participant({ learningCertificateIssued: false, learningCertificateId: null, learningCertificateDate: null, learningFinishedAllLessons: false, status: ParticipantStatus.ASSIGNED });
    const team = await db.getRepository(Team).save({ name: "Existing team", cohortId: cohort.id, group: "Batch 1", inviteCode: randomUUID() });
    await db.getRepository(TeamMember).save({ teamId: team.id, participantId: p.id, status: TeamMemberStatus.CONFIRMED, role: TeamRole.MEMBER });
    const dto = input(); dto.profile.githubAccountStatus = "no_account"; delete dto.profile.githubUsername;
    const completed = await service.completeOnboarding(p.id, dto);
    expect(completed).toMatchObject({ githubUsername: null, githubAccountStatus: "no_account", status: ParticipantStatus.ASSIGNED, learningCertificateIssued: false });
    expect(await db.getRepository(TeamMember).countBy({ participantId: p.id, teamId: team.id })).toBe(1);
  });

  it("rolls profile changes back if preferences fail, without welcome effects", async () => {
    const p = await participant(), save = Repository.prototype.save;
    const spy = jest.spyOn(Repository.prototype, "save").mockImplementation(function(this: Repository<any>, ...args: any[]) { if (this.target === ParticipantPreference) throw new Error("Simulated preference write failure"); return (save as any).apply(this, args); });
    try { await expect(service.completeOnboarding(p.id, input())).rejects.toThrow("Simulated preference write failure"); } finally { spy.mockRestore(); }
    expect(await db.getRepository(Participant).findOneByOrFail({ id: p.id })).toMatchObject({ firstName: "Imported", onboardingComplete: false, profileConfirmedAt: null });
    expect(await db.getRepository(ParticipantPreference).countBy({ participantId: p.id })).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled(); expect(forums.addParticipantToForumChannels).not.toHaveBeenCalled();
  });

  it("blocks incomplete password changes, inactive participants/cohorts, duplicated sectors and foreign verticals without writes", async () => {
    const p = await participant({ mustChangePassword: true }); await expect(service.completeOnboarding(p.id, input())).rejects.toThrow("initial password");
    await db.getRepository(Participant).update(p.id, { mustChangePassword: false, status: ParticipantStatus.INACTIVE }); await expect(service.completeOnboarding(p.id, input())).rejects.toThrow("active participant");
    await db.getRepository(Participant).update(p.id, { status: ParticipantStatus.ACTIVE });
    const dto = input(); dto.preferences.backupSector = "education"; await expect(service.completeOnboarding(p.id, dto)).rejects.toThrow("different backup sector");
    const wrongCountry = input(); wrongCountry.profile.country = "Kenya"; await expect(service.completeOnboarding(p.id, wrongCountry)).rejects.toThrow("country enabled");
    const other = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    const vertical = await db.getRepository(Vertical).save({ name: "Other cohort vertical", cohortId: other.id });
    const foreign = input(); foreign.preferences.verticalId1 = vertical.id; await expect(service.completeOnboarding(p.id, foreign)).rejects.toThrow("your cohort");
    await db.getRepository(Cohort).update(cohort.id, { status: CohortStatus.ARCHIVED }); await expect(service.completeOnboarding(p.id, input())).rejects.toThrow("active participant");
    expect(await db.getRepository(ParticipantPreference).countBy({ participantId: p.id })).toBe(0);
  });

  it("makes simultaneous completion idempotent and does not overwrite confirmed answers on replay", async () => {
    const p = await participant(); await Promise.all([service.completeOnboarding(p.id, input()), service.completeOnboarding(p.id, input())]);
    const different = input(); different.profile.firstName = "Replay overwrite"; await service.completeOnboarding(p.id, different);
    expect(await db.getRepository(Participant).findOneByOrFail({ id: p.id })).toMatchObject({ firstName: "Confirmed" });
    expect(await db.getRepository(ParticipantPreference).countBy({ participantId: p.id })).toBe(1); expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it("lets returning participants complete the new matching profile without resetting access, status or sending another welcome", async () => {
    const p = await participant({ onboardingComplete: true, status: ParticipantStatus.ASSIGNED });
    const result = await service.completeOnboarding(p.id, input());
    expect(result).toMatchObject({ onboardingComplete: true, mustChangePassword: false, status: ParticipantStatus.ASSIGNED, preference: { matchingProfileCompletedAt: expect.any(Date), preferredRole: "sector_specialist" } });
    expect(notifications.create).not.toHaveBeenCalled(); expect(forums.addParticipantToForumChannels).not.toHaveBeenCalled();
  });

  it("preserves new matching answers when an older preferences client updates legacy fields", async () => {
    const p = await participant(); await service.completeOnboarding(p.id, input());
    await service.savePreferences(p.id, { crossCountryWilling: true, briefRankings: [] });
    expect(await service.getPreferences(p.id)).toMatchObject({ firstChoiceSector: "education", preferredRole: "sector_specialist", matchingProfileConsent: false, teamStatus: "need_team", crossCountryWilling: true });
  });

  it("changes cross-country eligibility in both directions without changing other answers, membership or sending welcome messages", async () => {
    const p = await participant(); await service.completeOnboarding(p.id, input());
    const before = await service.getPreferences(p.id);
    const team = await db.getRepository(Team).save({ name: "Preference team", cohortId: cohort.id, group: "Batch 1", inviteCode: randomUUID() });
    await db.getRepository(TeamMember).save({ teamId: team.id, participantId: p.id, status: TeamMemberStatus.CONFIRMED, role: TeamRole.LEAD });
    notifications.create.mockClear();
    const foreignMember = { ...p, id: randomUUID(), country: "Nigeria", preference: { ...before!, crossCountryWilling: true } };
    for (const willing of [true, false]) {
      const result = await service.updateCrossCountryPreference(p.id, willing);
      expect(result).toMatchObject({ crossCountryWilling: willing, preferencesUpdatedAt: expect.any(Date) });
      const { crossCountryWilling, preferencesUpdatedAt, updatedAt, ...preserved } = result;
      const { crossCountryWilling: oldWilling, preferencesUpdatedAt: oldPreferencesAt, updatedAt: oldUpdatedAt, ...original } = before!;
      expect(preserved).toEqual(original);
      const current = await service.findOne(p.id);
      expect(canShareTeam([current, foreignMember])).toBe(willing);
      expect(await db.getRepository(TeamMember).countBy({ participantId: p.id, teamId: team.id })).toBe(1);
    }
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("can record a cross-country answer for a legacy participant without completing matching or granting visibility", async () => {
    const p = await participant({ onboardingComplete: true });
    const result = await service.updateCrossCountryPreference(p.id, true);
    expect(result).toMatchObject({ crossCountryWilling: true, briefRankings: [], matchingProfileCompletedAt: null, matchingProfileConsent: null });
  });

  it("hides nonconsenting and legacy profiles from participant searches, keeps staff access and excludes private fields from consenting results", async () => {
    const p = await participant(); await service.completeOnboarding(p.id, input());
    await participant({ onboardingComplete: true, status: ParticipantStatus.READY });
    const teams = Object.assign(Object.create(TeamsService.prototype), { memberRepository: db.getRepository(TeamMember), participantRepository: db.getRepository(Participant) }) as TeamsService;
    expect(await teams.searchAvailableParticipants(cohort.id, "", 10, "Batch 1", true)).toEqual([]);
    expect(await teams.searchAvailableParticipants(cohort.id, "", 10, "Batch 1", false)).toHaveLength(2);
    const allowed = await service.updateMatchingConsent(p.id, true);
    expect(allowed).toMatchObject({ matchingProfileConsent: true, matchingProfileConsentAt: expect.any(Date) });
    const visible = await teams.searchAvailableParticipants(cohort.id, "", 10, "Batch 1", true);
    expect(visible).toHaveLength(1); expect(visible[0]).toMatchObject({ id: p.id, firstName: "Confirmed", preference: { preferredRole: "sector_specialist", firstChoiceSector: "education" } });
    expect(JSON.stringify(visible)).not.toMatch(/email|phone|certificate|password|lmsEmail|gender/i);
    await service.updateMatchingConsent(p.id, false);
    expect(await teams.searchAvailableParticipants(cohort.id, "", 10, "Batch 1", true)).toEqual([]);
  });
});
