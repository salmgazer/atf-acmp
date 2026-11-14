import "reflect-metadata";
import { DataSource, EntityManager } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Team, TeamMember, TeamMemberStatus, TeamRole } from "@/database/entities/team.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { AuditLog } from "@/database/entities/audit-log.entity";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { participantBriefScope } from "@/common/services/brief-country-access";
import { isQualifiedBuilder } from "@acmp/shared";

const url = process.env.ACMP_TEST_DATABASE_URL;
(url ? describe : describe.skip)("Participant profile and matching edits", () => {
  let db: DataSource, service: ParticipantsService, participant: Participant, preference: ParticipantPreference, cohort: Cohort, team: Team;
  beforeAll(async () => {
    const target = new URL(url!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(target.pathname) || !["127.0.0.1", "localhost", "postgres"].includes(target.hostname)) throw new Error("Disposable local regression database required");
    db = new DataSource({ type: "postgres", url, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE, countries: ["GH", "NG"], groups: ["Batch 1"] });
    participant = await db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", lmsEmail: randomUUID() + "@example.test", firstName: "Protected", lastName: "Learner", country: "Ghana", cohortId: cohort.id, group: "Batch 1", institution: "Protected institution", educationLevel: "Degree", fieldOfStudy: "Medicine", gender: "Female", phoneNumber: "+233200000001", whatsappNumber: "+233200000002", pythonSkill: "Intermediate", city: "Accra", githubUsername: "old-user", learningCertificateIssued: true, learningCertificateId: randomUUID(), learningCertificateDate: "2026-11-10", learningFinishedAllLessons: true, learningHalfwayReached: true, passwordHash: "protected-hash", onboardingComplete: true, mustChangePassword: false, status: ParticipantStatus.ASSIGNED });
    preference = await db.getRepository(ParticipantPreference).save({ participantId: participant.id, buildDeployAbility: "confident", preferredRole: "builder", firstChoiceSector: "education", backupSector: "health", teamStatus: "full_team", matchingProfileCompletedAt: new Date(), crossCountryWilling: false, matchingProfileConsent: false, matchingProfileConsentAt: new Date("2026-11-10T00:00:00Z"), matchingProfileConsentVersion: "2026-11-07", briefRankings: [] });
    team = await db.getRepository(Team).save({ name: "Existing team", cohortId: cohort.id, group: "Batch 1", country: "Ghana", inviteCode: randomUUID() });
    await db.getRepository(TeamMember).save({ participantId: participant.id, teamId: team.id, role: TeamRole.LEAD, status: TeamMemberStatus.CONFIRMED });
    service = new ParticipantsService(db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Cohort), { create: jest.fn() } as any, {} as any, {} as any, { addParticipantToForumChannels: jest.fn() } as any);
  });
  const profile = (changes: object) => service.update(participant.id, { expectedUpdatedAt: participant.updatedAt.toISOString(), ...changes } as any);
  const matching = (changes: object) => service.updateMatchingProfile(participant.id, { expectedUpdatedAt: preference.updatedAt.toISOString(), ...changes } as any);

  it("saves allowed details, refreshes brief-country scope and builder eligibility, and preserves protected data and memberships", async () => {
    const result = await profile({ country: "NG", city: "Lagos", currentAffiliation: "Researcher", pythonSkill: "Beginner", gitSkill: "Intermediate", aiExperience: "Some experience", githubUsername: "new-user", skills: ["Python", "Research"], interests: [] });
    expect(result).toMatchObject({ country: "Nigeria", city: "Lagos", githubAccountStatus: "has_account", firstName: "Protected", phoneNumber: participant.phoneNumber, educationLevel: "Degree", learningCertificateId: participant.learningCertificateId, learningCertificateIssued: true, status: ParticipantStatus.ASSIGNED, group: "Batch 1", onboardingComplete: true });
    expect((await participantBriefScope(db.manager, participant.id)).countries).toEqual(["Nigeria"]);
    expect(isQualifiedBuilder(result)).toBe(false);
    expect(await db.getRepository(Participant).findOne({ where: { id: participant.id }, select: { passwordHash: true } })).toMatchObject({ passwordHash: "protected-hash" });
    expect(await db.getRepository(TeamMember).countBy({ participantId: participant.id, teamId: team.id })).toBe(1);
    expect(await service.getPreferences(participant.id)).toMatchObject({ matchingProfileConsent: false, preferredRole: "builder" });
    expect(await db.getRepository(AuditLog).findOneByOrFail({ entityId: participant.id })).toMatchObject({ before: { city: "Accra" }, after: { city: "Lagos" } });
  });
  it.each(["firstName", "lastName", "age", "educationLevel", "institution", "fieldOfStudy", "gender", "phoneNumber", "whatsappNumber", "email", "lmsEmail", "learningCertificateId", "certificateId", "learningCertificateIssued", "learningHalfwayReached", "status", "group", "passwordHash"])("rejects protected %s even for an internal profile call, without partial writes", async field => {
    await expect(profile({ city: "Must not save", [field]: "changed" })).rejects.toThrow("protected profile fields");
    expect((await service.findOne(participant.id)).city).toBe("Accra");
  });
  it("rejects a foreign country and stale profile edits, and supports clearing optional fields", async () => {
    await expect(profile({ country: "Kenya" })).rejects.toThrow("country enabled");
    const changed = await profile({ city: null, githubUsername: null });
    expect(changed).toMatchObject({ city: null, githubUsername: null, githubAccountStatus: "no_account" });
    await expect(profile({ city: "Stale overwrite" })).rejects.toThrow("profile changed");
  });
  it("keeps profile-picture upload separate from arbitrary profile changes", async () => {
    const result = await service.updateProfilePicture(participant.id, "https://assets.example.test/profile.png");
    expect(result).toMatchObject({ profileImageUrl: "https://assets.example.test/profile.png", firstName: "Protected", educationLevel: "Degree", email: participant.email });
    await expect(profile({ profileImageUrl: "untrusted" })).rejects.toThrow("protected profile fields");
  });
  it("edits matching answers atomically without changing membership, registration answers or unrelated consent evidence", async () => {
    const vertical = await db.getRepository(Vertical).save({ name: "Education", cohortId: cohort.id });
    const result = await matching({ buildDeployAbility: "with_support", preferredRole: "sector_specialist", firstChoiceSector: "health", backupSector: "education", teamStatus: "need_team", crossCountryWilling: true, verticalId1: vertical.id, availabilityNotes: "Weekends" });
    expect(result).toMatchObject({ buildDeployAbility: "with_support", preferredRole: "sector_specialist", firstChoiceSector: "health", backupSector: "education", teamStatus: "need_team", crossCountryWilling: true, matchingProfileConsent: false, matchingProfileConsentAt: preference.matchingProfileConsentAt, matchingProfileCompletedAt: preference.matchingProfileCompletedAt, verticalId1: vertical.id, availabilityNotes: "Weekends", briefRankings: [] });
    expect(await db.getRepository(TeamMember).countBy({ participantId: participant.id, teamId: team.id })).toBe(1);
    expect((await service.findOne(participant.id)).status).toBe(ParticipantStatus.ASSIGNED);
    expect(await db.getRepository(AuditLog).findOneByOrFail({ entityId: preference.id })).toMatchObject({ before: { preferredRole: "builder" }, after: { preferredRole: "sector_specialist" } });
  });
  it("updates consent evidence only for a visibility change and rejects edits made stale by a quick preference change", async () => {
    const visible = await matching({ matchingProfileConsent: true });
    expect(visible.matchingProfileConsentAt).not.toEqual(preference.matchingProfileConsentAt);
    expect(visible.matchingProfileConsent).toBe(true);
    await expect(matching({ preferredRole: "sector_specialist" })).rejects.toThrow("matching profile changed");
    preference = visible;
    await service.updateCrossCountryPreference(participant.id, true);
    await expect(matching({ crossCountryWilling: false })).rejects.toThrow("matching profile changed");
  });
  it("rejects duplicate sectors, inactive/foreign or duplicate verticals and foreign brief rankings without partial writes", async () => {
    await expect(matching({ firstChoiceSector: "health", availabilityNotes: "Must not save" })).rejects.toThrow("different backup sector");
    const other = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    const foreign = await db.getRepository(Vertical).save({ name: "Foreign", cohortId: other.id });
    const inactive = await db.getRepository(Vertical).save({ name: "Inactive", cohortId: cohort.id, isActive: false });
    for (const id of [foreign.id, inactive.id]) await expect(matching({ verticalId1: id })).rejects.toThrow("active verticals from your cohort");
    await expect(matching({ verticalId1: foreign.id, verticalId2: foreign.id })).rejects.toThrow("different programme verticals");
    await expect(matching({ briefRankings: [randomUUID()] })).rejects.toThrow("Rank only approved briefs");
    expect((await service.getPreferences(participant.id))?.availabilityNotes).toBeNull();
  });
  it("rolls back both types of edits if their audit record fails", async () => {
    const save = EntityManager.prototype.save;
    const spy = jest.spyOn(EntityManager.prototype, "save").mockImplementation(function(this: EntityManager, ...args: any[]) { if (args[0] === AuditLog) throw new Error("Audit failed"); return (save as any).apply(this, args); });
    try { await expect(profile({ city: "Must roll back" })).rejects.toThrow("Audit failed"); await expect(matching({ preferredRole: "sector_specialist" })).rejects.toThrow("Audit failed"); } finally { spy.mockRestore(); }
    expect((await service.findOne(participant.id)).city).toBe("Accra"); expect((await service.getPreferences(participant.id))?.preferredRole).toBe("builder");
  });
});
