import "reflect-metadata";
import { DataSource, EntityManager } from "typeorm";
import { randomUUID } from "crypto";
import * as path from "path";
import * as Papa from "papaparse";
import * as bcrypt from "bcrypt";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Team, TeamMember, TeamMemberStatus, TeamRole } from "@/database/entities/team.entity";
import { AuditLog } from "@/database/entities/audit-log.entity";
import { ParticipantImportService } from "@/modules/participants/participant-import.service";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Reviewed participant learning imports", () => {
  let db: DataSource, service: ParticipantImportService, cohort: Cohort, actor: User;
  let queue: { add: jest.Mock; setGlobalConcurrency: jest.Mock }, invites: { inviteImported: jest.Mock };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    cohort = await db.getRepository(Cohort).save({ name: "Learning import " + randomUUID(), status: CohortStatus.ACTIVE, countries: ["GH", "NG"], groups: ["A", "B"] });
    actor = await db.getRepository(User).save({ email: randomUUID() + "@example.test", role: Role.PROGRAM_MANAGER, isActive: true });
    queue = { add: jest.fn(async () => ({ id: "queued" })), setGlobalConcurrency: jest.fn() };
    invites = { inviteImported: jest.fn(async () => ["invitation-job"]) };
    service = new ParticipantImportService(db, queue as any, invites as any);
  });
  const source = (values: Record<string, string> = {}) => ({ participant_id: "external-" + randomUUID(), first_name: "Example", last_name: "Learner", lms_email: randomUUID() + "@example.test", country: "Ghana", halfway_reached: "Yes", certificate: "No", finished_all_lessons: "No", ...values });
  const input = (rows: Record<string, string>[], extra: object = {}) => ({ cohortId: cohort.id, csv: Papa.unparse(rows), sourceName: "participants.csv", group: "A", sendWelcomeEmail: false, ...extra });
  async function apply(dto: ReturnType<typeof input>) {
    const preview = await service.preview(dto, actor);
    expect(preview.errors).toEqual([]); expect(preview.records.filter(row => row.outcome === "conflict")).toEqual([]);
    const batch = await service.enqueue({ ...dto, previewHash: preview.previewHash }, actor);
    await service.process(batch.id);
    return service.status(batch.id, actor);
  }
  const existing = (values: Partial<Participant> = {}) => db.getRepository(Participant).save({ participantId: "external-" + randomUUID(), email: randomUUID() + "@example.test", firstName: "Confirmed", lastName: "Profile", country: "Ghana", cohortId: cohort.id, group: "B", status: ParticipantStatus.ASSIGNED, mustChangePassword: false, onboardingComplete: true, passwordHash: "unchanged-test-hash", firebaseUid: "unchanged-firebase", skills: ["Python"], interests: ["Health"], ...values });

  it("previews without writes and admits halfway learners without issuing an ACMP certificate or completing onboarding", async () => {
    const first = source({ phone: "+233200000001", whatsapp_number: "+233200000002", city_clean: "Accra", field_of_study_clean: "Education", github_username: "https://github.com/example-user" });
    const second = source({ halfway_reached: "No" });
    const dto = input([first, second], { sendWelcomeEmail: true });
    const before = await db.getRepository(Participant).count();
    const preview = await service.preview(dto, actor);
    expect(preview).toMatchObject({ ready: true, counts: { new: 1, excluded: 1, updated: 0 } });
    expect(await db.getRepository(Participant).count()).toBe(before);
    const batch = await apply(dto);
    expect(batch.state).toBe("completed");
    const p = await db.getRepository(Participant).findOneOrFail({ where: { participantId: first.participant_id }, select: { id: true, status: true, passwordHash: true, lmsEmail: true, email: true, group: true, onboardingComplete: true, learningCertificateIssued: true, learningHalfwayReached: true, githubUsername: true, learningImportedAt: true } });
    expect(p.status).toBe(ParticipantStatus.IMPORTED);
    expect(p).toMatchObject({ group: "A", lmsEmail: first.lms_email, email: first.lms_email, onboardingComplete: false, learningCertificateIssued: false, learningHalfwayReached: true, githubUsername: "example-user", learningImportedAt: expect.any(Date) });
    expect(await bcrypt.compare(first.participant_id, p.passwordHash!)).toBe(true);
    expect(await db.getRepository(Participant).countBy({ participantId: second.participant_id })).toBe(0);
    expect(await db.getRepository("Certificate").countBy({ participantId: p.id })).toBe(0);
    expect(invites.inviteImported).toHaveBeenCalledWith([p.id], actor.id, batch.id);
    expect(await db.getRepository(AuditLog).findOneBy({ entityId: batch.id })).toMatchObject({ actorId: actor.id, action: "bulk_import" });
    expect(JSON.stringify(batch)).not.toContain(first.participant_id + "\",\"password");
  });

  it("updates only learning fields by default and preserves established accounts, profiles, groups and memberships", async () => {
    const p = await existing({ phoneNumber: "+233299999999", city: "Existing city" });
    const team = await db.getRepository(Team).save({ name: "Existing team", cohortId: cohort.id, group: "B", inviteCode: randomUUID() });
    await db.getRepository(TeamMember).save({ teamId: team.id, participantId: p.id, role: TeamRole.MEMBER, status: TeamMemberStatus.CONFIRMED });
    const row = source({ participant_id: p.participantId, lms_email: p.email, first_name: "Overwritten?", phone: "+233200000001", city_clean: "New city", certificate: "Yes", certificate_id: "cert-" + randomUUID(), certificate_date: "2026-11-06", finished_all_lessons: "No" });
    const dto = input([row], { sendWelcomeEmail: true });
    const batch = await apply(dto);
    const updated = await db.getRepository(Participant).findOneOrFail({ where: { id: p.id }, select: { id: true, passwordHash: true, firebaseUid: true, firstName: true, phoneNumber: true, city: true, country: true, cohortId: true, group: true, status: true, mustChangePassword: true, onboardingComplete: true, skills: true, learningCertificateIssued: true, learningCertificateId: true, learningFinishedAllLessons: true } });
    expect(updated).toMatchObject({ passwordHash: p.passwordHash, firebaseUid: p.firebaseUid, firstName: p.firstName, phoneNumber: p.phoneNumber, city: p.city, cohortId: p.cohortId, group: "B", status: "assigned", mustChangePassword: false, onboardingComplete: true, skills: ["Python"], learningCertificateIssued: true, learningCertificateId: row.certificate_id, learningFinishedAllLessons: false });
    expect(await db.getRepository(TeamMember).countBy({ teamId: team.id, participantId: p.id })).toBe(1);
    expect(batch.result.affectedTeamIds).toEqual([team.id]);
    expect(invites.inviteImported).not.toHaveBeenCalled();
    const repeated = await apply(dto);
    expect(repeated.result.counts).toMatchObject({ new: 0, updated: 0, unchanged: 1 });
    expect(invites.inviteImported).not.toHaveBeenCalled();
  });

  it("supports ID-only update files and selected profile fields while blanks preserve existing data", async () => {
    const p = await existing({ lmsEmail: "linked-" + randomUUID() + "@example.test", city: "Old city", phoneNumber: "+233299999999" });
    const dto = input([{ participant_id: p.participantId, city_clean: "New city", phone: "", first_name: "Ignored" }], { mode: "update_only", updateFields: ["city", "phoneNumber"] });
    const batch = await apply(dto);
    expect(batch.result.counts).toMatchObject({ updated: 1 });
    expect(await db.getRepository(Participant).findOneByOrFail({ id: p.id })).toMatchObject({ city: "New city", phoneNumber: p.phoneNumber, firstName: p.firstName });
    const unknown = await service.preview(input([source()], { mode: "update_only" }), actor);
    expect(unknown.counts).toMatchObject({ new: 0, excluded: 1 });
    const createOnly = await service.preview(input([source({ participant_id: p.participantId, lms_email: p.lmsEmail! })], { mode: "create_only" }), actor);
    expect(createOnly.counts.excluded).toBe(1);
  });

  it("requires explicit correction review before reversals and shows linked certificate clearing", async () => {
    const p = await existing({ learningCertificateIssued: true, learningCertificateId: randomUUID(), learningCertificateDate: "2026-11-06", learningHalfwayReached: true, learningFinishedAllLessons: true });
    const dto = input([{ participant_id: p.participantId, certificate: "No", finished_all_lessons: "No" }], { mode: "update_only" });
    expect((await service.preview(dto, actor)).counts.conflict).toBe(1);
    const approved = { ...dto, allowLearningCorrections: true };
    const preview = await service.preview(approved, actor);
    expect(preview.records[0].changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "learningCertificateId", after: null })]));
    await apply(approved);
    expect(await db.getRepository(Participant).findOneByOrFail({ id: p.id })).toMatchObject({ learningCertificateIssued: false, learningCertificateId: null, learningCertificateDate: null, learningFinishedAllLessons: false, learningHalfwayReached: true });
  });

  it("blocks conflicting identities, duplicate source rows, reused certificates and deleted accounts", async () => {
    const p = await existing({ learningCertificateId: "owned-" + randomUUID(), learningCertificateIssued: true });
    const wrongEmail = await service.preview(input([source({ participant_id: p.participantId })]), actor);
    expect(wrongEmail.counts.conflict).toBe(1);
    const copied = source();
    expect((await service.preview(input([copied, copied]), actor)).counts.conflict).toBe(2);
    expect((await service.preview(input([source({ certificate: "Yes", certificate_id: p.learningCertificateId! })]), actor)).counts.conflict).toBe(1);
    await db.getRepository(Participant).softDelete(p.id);
    expect((await service.preview(input([{ participant_id: p.participantId }], { mode: "update_only" }), actor)).counts.conflict).toBe(1);
  });

  it("invalidates stale previews before queueing and again before applying a queued import", async () => {
    const p = await existing();
    const dto = input([{ participant_id: p.participantId, halfway_reached: "Yes" }], { mode: "update_only" });
    const preview = await service.preview(dto, actor);
    await db.getRepository(Participant).update(p.id, { firstName: "Changed after preview" });
    await expect(service.enqueue({ ...dto, previewHash: preview.previewHash }, actor)).rejects.toThrow("Refresh the preview");
    expect(queue.add).not.toHaveBeenCalled();
    const fresh = await service.preview(dto, actor), batch = await service.enqueue({ ...dto, previewHash: fresh.previewHash }, actor);
    await db.getRepository(Participant).update(p.id, { firstName: "Changed after queueing" });
    await service.process(batch.id);
    expect(await service.status(batch.id, actor)).toMatchObject({ state: "failed", error: expect.stringContaining("Refresh the preview") });
    expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).learningHalfwayReached).toBeNull();
  });

  it("rolls back earlier inserts if a later update fails and never queues invitations for rolled-back records", async () => {
    const p = await existing(), first = source();
    const dto = input([first, { participant_id: p.participantId, halfway_reached: "Yes" }], { sendWelcomeEmail: true });
    const preview = await service.preview(dto, actor), batch = await service.enqueue({ ...dto, previewHash: preview.previewHash }, actor);
    const update = EntityManager.prototype.update;
    const spy = jest.spyOn(EntityManager.prototype, "update").mockImplementation(async function(this: EntityManager, target: any, criteria: any, patch: any) {
      if (target === Participant && criteria === p.id) throw new Error("Simulated write failure");
      return update.call(this, target, criteria, patch);
    });
    try { await service.process(batch.id); } finally { spy.mockRestore(); }
    expect((await service.status(batch.id, actor)).state).toBe("failed");
    expect(await db.getRepository(Participant).countBy({ participantId: first.participant_id })).toBe(0);
    expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).learningHalfwayReached).toBeNull();
    expect(invites.inviteImported).not.toHaveBeenCalled();
  });

  it("reports invitation queue failures separately after committing accounts and does not resend on unchanged reruns", async () => {
    const row = source(); invites.inviteImported.mockRejectedValueOnce(new Error("Provider unavailable"));
    const dto = input([row], { sendWelcomeEmail: true }), batch = await apply(dto);
    expect(batch).toMatchObject({ state: "completed", result: { invitationState: "failed", invitationWarning: expect.any(String) } });
    expect(await db.getRepository(Participant).countBy({ participantId: row.participant_id })).toBe(1);
    await apply(dto);
    expect(invites.inviteImported).toHaveBeenCalledTimes(1);
  });

  it("refuses background writes after the importing staff account loses its management role", async () => {
    const dto = input([source()]), preview = await service.preview(dto, actor), batch = await service.enqueue({ ...dto, previewHash: preview.previewHash }, actor);
    await db.getRepository(User).update(actor.id, { role: Role.VIEWER });
    await service.process(batch.id);
    expect((await service.status(batch.id, { ...actor, role: Role.PROGRAM_MANAGER })).state).toBe("failed");
    expect(await db.getRepository(Participant).countBy({ participantId: Papa.parse<Record<string, string>>(dto.csv, { header: true }).data[0].participant_id })).toBe(0);
  });
});
