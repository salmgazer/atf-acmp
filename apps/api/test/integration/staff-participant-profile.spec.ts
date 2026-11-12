import "reflect-metadata";
import { DataSource, EntityManager } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { AuditLog } from "@/database/entities/audit-log.entity";
import { User, Role } from "@/database/entities/user.entity";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { StaffParticipantProfileDto } from "@/modules/participants/dto/staff-participant-profile.dto";
import { participantBriefScope } from "@/common/services/brief-country-access";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Staff participant profile editing", () => {
  let db: DataSource, cohort: Cohort, participant: Participant, actor: User, service: ParticipantsService;
  const effects = { create: jest.fn(), sendWelcome: jest.fn() };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost", "postgres"].includes(url.hostname)) throw new Error("Disposable regression database required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    jest.clearAllMocks();
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), countries: ["GH", "NG"], groups: ["Batch 1"], status: CohortStatus.ACTIVE });
    actor = await db.getRepository(User).save({ email: randomUUID() + "@example.test", passwordHash: "staff-hash", firstName: "Example", lastName: "Manager", role: Role.PROGRAM_MANAGER });
    participant = await db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", lmsEmail: randomUUID() + "@lms.example.test", firstName: "Imported", lastName: "Learner", country: "Ghana", cohortId: cohort.id, group: "Batch 1", city: "Accra", pythonSkill: "Intermediate", learningHalfwayReached: true, learningFinishedAllLessons: true, learningCertificateIssued: true, learningCertificateId: randomUUID(), learningCertificateDate: "2026-10-25", learningImportedAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z"), mustChangePassword: false, onboardingComplete: true, status: ParticipantStatus.ASSIGNED, passwordHash: "preserved-hash" });
    await db.getRepository(ParticipantPreference).save({ participantId: participant.id, matchingProfileConsent: false, preferredRole: "builder", buildDeployAbility: "confident" });
    service = new ParticipantsService(db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Cohort), effects as any, effects as any, {} as any, {} as any);
  });
  const save = (changes: Partial<StaffParticipantProfileDto>) => service.updateStaffProfile(participant.id, { expectedUpdatedAt: participant.updatedAt.toISOString(), ...changes }, actor);
  const persisted = () => db.getRepository(Participant).findOne({ where: { id: participant.id }, select: { id: true, email: true, participantId: true, passwordHash: true, cohortId: true, group: true, city: true, learningCertificateIssued: true, learningCertificateId: true, learningCertificateDate: true, learningImportedAt: true, mustChangePassword: true, onboardingComplete: true, status: true } });

  it("edits personal/imported fields and updates brief country scope without changing credentials, grouping or consent", async () => {
    const lmsEmail = "corrected-" + randomUUID() + "@lms.example.test";
    const updated = await save({ firstName: " Corrected ", country: "NG", lmsEmail: lmsEmail.toUpperCase(), whatsappNumber: "+2341234567", city: "Lagos", fieldOfStudy: "Law", pythonSkill: "Advanced", githubUsername: "valid-user", skills: [" Python ", "Python"] });
    expect(updated).toMatchObject({ firstName: "Corrected", country: "Nigeria", lmsEmail, city: "Lagos", githubUsername: "valid-user", githubAccountStatus: "has_account", skills: ["Python"] });
    expect(await persisted()).toMatchObject({ email: participant.email, participantId: participant.participantId, passwordHash: "preserved-hash", cohortId: cohort.id, group: "Batch 1", mustChangePassword: false, onboardingComplete: true, status: "assigned", learningImportedAt: participant.learningImportedAt });
    expect(await db.getRepository(ParticipantPreference).findOneByOrFail({ participantId: participant.id })).toMatchObject({ matchingProfileConsent: false, preferredRole: "builder" });
    expect((await participantBriefScope(db.manager, participant.id)).countries).toEqual(["Nigeria"]);
    const audit = await db.getRepository(AuditLog).findOneByOrFail({ entityId: participant.id });
    expect(audit).toMatchObject({ actorId: actor.id, before: { firstName: "Imported", city: "Accra" }, after: { firstName: "Corrected", city: "Lagos" }, metadata: { source: "staff-profile-editor" } });
    expect(JSON.stringify(audit)).not.toContain("preserved-hash");
    expect(effects.create).not.toHaveBeenCalled(); expect(effects.sendWelcome).not.toHaveBeenCalled();
  });

  it("requires review for learning reversals and clears certificate identity on a reviewed withdrawal", async () => {
    await expect(save({ learningCertificateIssued: false })).rejects.toThrow("Review and confirm");
    expect((await persisted())?.learningCertificateIssued).toBe(true);
    const updated = await save({ learningCertificateIssued: false, allowLearningCorrections: true });
    expect(updated).toMatchObject({ learningCertificateIssued: false, learningCertificateId: null, learningCertificateDate: null });
    const audit = await db.getRepository(AuditLog).findOneByOrFail({ entityId: participant.id });
    expect(audit).toMatchObject({ before: { learningCertificateId: participant.learningCertificateId }, after: { learningCertificateId: null }, metadata: { learningCorrectionReviewed: true } });
  });

  it("accepts a new certificate and completion status while preserving the import timestamp", async () => {
    await db.getRepository(Participant).update(participant.id, { learningCertificateIssued: false, learningCertificateId: null, learningCertificateDate: null, learningFinishedAllLessons: false });
    participant = await db.getRepository(Participant).findOneByOrFail({ id: participant.id });
    const updated = await save({ learningCertificateIssued: true, learningCertificateId: "NEW-" + randomUUID(), learningCertificateDate: "2026-11-10", learningFinishedAllLessons: true });
    expect(updated.learningCertificateId).toMatch(/^NEW-/); expect(updated.learningFinishedAllLessons).toBe(true);
    expect(updated.learningImportedAt).toEqual(participant.learningImportedAt);
  });

  it("rejects inconsistent certificate values, impossible dates and duplicate identities atomically", async () => {
    await expect(save({ city: "Should roll back", learningCertificateId: null, allowLearningCorrections: true })).rejects.toThrow("requires a certificate ID");
    await expect(save({ learningCertificateDate: "2026-02-30", allowLearningCorrections: true })).rejects.toThrow("valid learning certificate date");
    const other = await db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", lmsEmail: "Other-" + randomUUID() + "@example.test", firstName: "Other", lastName: "Learner", country: "Ghana", cohortId: cohort.id, group: "Batch 1", learningCertificateId: "taken-" + randomUUID() });
    await expect(save({ lmsEmail: other.lmsEmail })).rejects.toThrow("LMS email belongs");
    await db.getRepository(Participant).softDelete(other.id);
    await expect(save({ learningCertificateId: other.learningCertificateId, allowLearningCorrections: true })).rejects.toThrow("certificate ID belongs");
    expect((await persisted())?.city).toBe("Accra"); expect(await db.getRepository(AuditLog).countBy({ entityId: participant.id })).toBe(0);
  });

  it("allows unrelated profile corrections on legacy learning records without a certificate ID", async () => {
    await db.getRepository(Participant).update(participant.id, { learningCertificateId: null });
    participant = await db.getRepository(Participant).findOneByOrFail({ id: participant.id });
    expect((await save({ city: "Corrected city" })).city).toBe("Corrected city");
  });

  it("rejects stale and simultaneous updates instead of overwriting newer edits", async () => {
    const results = await Promise.allSettled([save({ city: "First" }), save({ city: "Second" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toContain("Participant changed");
    expect(await db.getRepository(AuditLog).countBy({ entityId: participant.id })).toBe(1);
  });

  it("rolls back the participant edit if the audit entry cannot be saved", async () => {
    const original = EntityManager.prototype.save;
    const spy = jest.spyOn(EntityManager.prototype, "save").mockImplementation(function(this: EntityManager, ...args: any[]) { if (args[0] === AuditLog) throw new Error("Audit unavailable"); return (original as any).apply(this, args); });
    try { await expect(save({ city: "Should roll back" })).rejects.toThrow("Audit unavailable"); } finally { spy.mockRestore(); }
    expect((await persisted())?.city).toBe("Accra");
  });

  it("does not trust protected fields even for internal calls, and rejects non-manager identities", async () => {
    await save({ city: "Allowed", email: "hijacked@example.test", passwordHash: "changed", group: "Other" } as any);
    expect(await persisted()).toMatchObject({ email: participant.email, passwordHash: "preserved-hash", group: "Batch 1" });
    await expect(service.updateStaffProfile(participant.id, { expectedUpdatedAt: participant.updatedAt.toISOString(), city: "Denied" }, { id: participant.id, role: "participant" })).rejects.toThrow("Only staff managers");
  });
});
