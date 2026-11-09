import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Organization, OrganizationUser, OrganizationUserRole } from "@/database/entities/organization.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Brief, BriefRevision, BriefStatus } from "@/database/entities/brief.entity";
import { BriefContact } from "@/database/entities/brief-contact.entity";
import { PartnerImportRecord } from "@/database/entities/partner-import-record.entity";
import { AuditLog } from "@/database/entities/audit-log.entity";
import { SubmissionImportService } from "@/modules/organizations/submission-import.service";
import * as contacts from "@/common/services/brief-contacts";
import { submissionFixture } from "@/modules/organizations/__fixtures__/partner-submissions";
import { PublicService } from "@/modules/public/public.service";
import { BriefScoringService } from "@/modules/briefs/brief-scoring.service";
import { parseSubmissionCsv } from "@/modules/organizations/submission-import-parser";
import { ConfigService } from "@nestjs/config";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { JwtStrategy } from "@/auth/strategies/jwt.strategy";
import { Vertical } from "@/database/entities/vertical.entity";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Partner submission imports with PostgreSQL", () => {
  let db: DataSource, service: SubmissionImportService, cohort: Cohort, actor: User;
  let fixture: ReturnType<typeof submissionFixture>;
  const cache = { del: jest.fn(async () => undefined) };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations(); service = new SubmissionImportService(db, cache as any);
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    cache.del.mockClear();
    fixture = submissionFixture();
    cohort = await db.getRepository(Cohort).save({ name: "Import cohort " + randomUUID(), status: CohortStatus.ACTIVE, countries: ["Ghana"] });
    actor = await db.getRepository(User).save({ email: randomUUID() + "@example.test", role: Role.PROGRAM_MANAGER, isActive: true });
  });
  const input = () => ({ csv: fixture.csv(), sourceName: "test-country.csv", sourceTimezone: "Africa/Accra", cohortId: cohort.id });

  it("previews without writes, creates one partner with brief contacts and one owner, and preserves historical data", async () => {
    fixture.rows[0]["The opportunity and who it affects"] = "Long description " + "a".repeat(7800);
    fixture.rows[0]["Records and data that exist"] = "b".repeat(13000);
    const before = await db.getRepository(Organization).count();
    let preview = await service.preview(input(), actor);
    expect(preview).toMatchObject({ ready: true, newPartners: 1, newUsers: 5, newBriefs: 3, skippedBriefs: 0 });
    expect(await db.getRepository(Organization).count()).toBe(before);
    const selected = { ...input(), primaryContacts: { [preview.organizations[0].key]: fixture.submitter } };
    preview = await service.preview(selected, actor);
    const receipt = await service.apply({ ...selected, previewHash: preview.previewHash }, actor);
    expect(receipt).toMatchObject({ createdPartners: 1, createdUsers: 5, createdBriefs: 3 });
    const partner = await db.getRepository(Organization).findOneByOrFail({ email: fixture.submitter });
    expect(partner).toMatchObject({ status: "pending", publicSubmission: false, consentGiven: false, industry: "Healthcare" });
    const links = await db.getRepository(OrganizationUser).findBy({ organizationId: partner.id });
    expect(links.filter(link => link.role === OrganizationUserRole.OWNER)).toHaveLength(1);
    const owner = await db.getRepository(User).findOneByOrFail({ email: fixture.submitter });
    expect(links.find(link => link.userId === owner.id)?.isPrimary).toBe(true);
    const briefs = await db.getRepository(Brief).find({ where: { organizationId: partner.id }, order: { title: "ASC" } });
    expect(briefs[0]).toMatchObject({ status: "submitted", description: fixture.rows[0]["The opportunity and who it affects"], countryLeadNotes: "Keep this review note" });
    expect(briefs[0].dataDescription).toHaveLength(13000);
    expect(briefs[0].submittedAt?.toISOString()).toBe("2026-11-04T08:17:18.000Z");
    expect(briefs[1].impactScore).toBeNull();
    const associations = await db.getRepository(BriefContact).findBy({ briefId: briefs[0].id });
    expect(associations).toEqual(expect.arrayContaining([expect.objectContaining({ email: fixture.hosts[0], isPrimary: true }), expect.objectContaining({ email: fixture.owner, isSubmitter: true, isPrimary: false })]));
    expect(await db.getRepository(PartnerImportRecord).countBy({ batchId: receipt.batchId })).toBe(3);
    expect(await db.getRepository(AuditLog).findOneBy({ entityId: receipt.batchId })).toMatchObject({ actorId: actor.id, action: "bulk_import" });
  });

  it("skips identical reruns and refuses changed source content or a stale preview", async () => {
    const preview = await service.preview(input(), actor);
    await expect(service.apply({ ...input(), sourceTimezone: "Africa/Nairobi", previewHash: preview.previewHash }, actor)).rejects.toThrow("Refresh the preview");
    await service.apply({ ...input(), previewHash: preview.previewHash }, actor);
    const repeat = await service.preview(input(), actor);
    expect(repeat).toMatchObject({ ready: true, newPartners: 0, newUsers: 0, newBriefs: 0, skippedBriefs: 3 });
    expect(await service.apply({ ...input(), previewHash: repeat.previewHash }, actor)).toMatchObject({ createdBriefs: 0, skippedBriefs: 3 });
    fixture.rows[0]["Opportunity title"] = "Changed imported title";
    const changed = await service.preview(input(), actor);
    expect(changed.ready).toBe(false);
    expect(changed.errors.some(error => error.message.includes("will not be overwritten"))).toBe(true);
  });

  it("rolls back partner, users, briefs and receipt if a contact association fails", async () => {
    const preview = await service.preview(input(), actor);
    const spy = jest.spyOn(contacts, "saveBriefContacts").mockRejectedValueOnce(new Error("Simulated association failure"));
    try { await expect(service.apply({ ...input(), previewHash: preview.previewHash }, actor)).rejects.toThrow("association failure"); }
    finally { spy.mockRestore(); }
    expect(await db.getRepository(Organization).findOneBy({ name: fixture.name })).toBeNull();
    expect(await db.getRepository(User).findOneBy({ email: fixture.owner })).toBeNull();
    expect(await db.getRepository(Brief).countBy({ sessionId: fixture.sessionId })).toBe(0);
    expect(await db.getRepository(PartnerImportRecord).countBy({ sessionId: fixture.sessionId })).toBe(0);
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id })).toBe(0);
  });

  it("blocks staff-email collisions, removed memberships and incompatible cohorts before any import", async () => {
    fixture.rows[0]["Email"] = actor.email; fixture.rows[1]["Email"] = actor.email;
    const conflict = await service.preview(input(), actor);
    expect(conflict.ready).toBe(false);
    expect(conflict.errors.some(error => error.message.includes("another role"))).toBe(true);
    await db.getRepository(Cohort).update(cohort.id, { countries: ["Kenya"] });
    expect((await service.preview(input(), actor)).errors.some(error => error.message.includes("not enabled"))).toBe(true);
  });

  it("rechecks a downgraded staff account before applying", async () => {
    const preview = await service.preview(input(), actor);
    await db.getRepository(User).update(actor.id, { role: Role.VIEWER });
    await expect(service.apply({ ...input(), previewHash: preview.previewHash }, actor)).rejects.toThrow("no longer authorized");
    expect(await db.getRepository(Organization).findOneBy({ name: fixture.name })).toBeNull();
  });

  it("public onboarding also creates a brief-specific contact login and preserves the submitter as the partner owner", async () => {
    const row = (await parseSubmissionCsv(fixture.csv(), "Africa/Accra")).rows[2];
    const mail = { sendCustomEmail: jest.fn(async () => undefined) };
    const publicService = new PublicService(db.getRepository(Organization), db.getRepository(Brief), { findOne: async () => cohort } as any, db.getRepository(User), db, new BriefScoringService(), mail as any, new ConfigService({ FRONTEND_URL: "http://localhost:3000" }));
    const result = await publicService.submitOrganizationBriefs({ sessionId: row.sessionId, org: row.org, opportunities: [row.opportunity as any], consentGiven: true });
    const partner = await db.getRepository(Organization).findOneByOrFail({ id: result.organizationId });
    expect(partner).toMatchObject({ publicSubmission: true, consentGiven: true, status: "pending", industry: "Healthcare" });
    const contact = await db.getRepository(User).findOneByOrFail({ email: fixture.hosts[2] });
    expect(await db.getRepository(OrganizationUser).findOneBy({ organizationId: partner.id, userId: contact.id })).toMatchObject({ role: OrganizationUserRole.MEMBER });
    expect(await db.getRepository(BriefContact).findOneBy({ briefId: result.briefIds![0], email: contact.email })).toMatchObject({ isPrimary: true });
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
    await db.getRepository(Organization).update(partner.id, { status: "approved" as any });
    const session = await db.getRepository(RefreshToken).save({ userId: contact.id, token: randomUUID(), isRevoked: false, expiresAt: new Date(Date.now() + 60000) });
    const principal = await new JwtStrategy(new ConfigService({ jwt: { secret: "contact-login-regression" } }), db).validate({ sub: contact.id, sid: session.id, role: "organization", iat: 1, exp: 9999999999 });
    expect(principal).toMatchObject({ organizationId: partner.id, role: Role.ORGANIZATION, email: contact.email });
  });

  it("concurrent imports cannot duplicate source rows or accounts", async () => {
    const preview = await service.preview(input(), actor);
    const outcomes = await Promise.allSettled([service.apply({ ...input(), previewHash: preview.previewHash }, actor), service.apply({ ...input(), previewHash: preview.previewHash }, actor)]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.getRepository(Organization).countBy({ name: fixture.name })).toBe(1);
    expect(await db.getRepository(PartnerImportRecord).countBy({ cohortId: cohort.id })).toBe(3);
  });

  it("preserves a legacy partner main contact's owner access and existing credentials when adding imported briefs", async () => {
    const partner = await db.getRepository(Organization).save({ name: fixture.name, email: fixture.owner, country: "Ghana", cohortId: cohort.id, contactPerson: "Existing partner contact" });
    const existing = await db.getRepository(User).save({ email: fixture.owner, role: Role.ORGANIZATION, isActive: true, passwordHash: "existing-test-credentials" });
    const preview = await service.preview(input(), actor);
    expect(preview).toMatchObject({ ready: true, newPartners: 0, newUsers: 4 });
    await service.apply({ ...input(), previewHash: preview.previewHash }, actor);
    expect(await db.getRepository(OrganizationUser).findOneBy({ organizationId: partner.id, userId: existing.id })).toMatchObject({ role: OrganizationUserRole.OWNER, isPrimary: true });
    expect((await db.getRepository(User).findOneOrFail({ where: { id: existing.id }, select: { passwordHash: true } })).passwordHash).toBe("existing-test-credentials");
    expect((await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).contactPerson).toBe("Existing partner contact");
  });

  async function load() {
    const preview = await service.preview(input(), actor);
    const receipt = await service.apply({ ...input(), previewHash: preview.previewHash }, actor);
    const partner = await db.getRepository(Organization).findOneByOrFail({ name: fixture.name });
    return { receipt, partner };
  }
  const updateInput = (fields = ["industry"] as import("@acmp/shared").SubmissionUpdateField[]) => ({ ...input(), mode: "update_existing" as const, updateFields: fields });

  it("backfills Industry alone once per partner without changing briefs, accounts, approvals, contacts or source receipts", async () => {
    const { partner } = await load();
    await db.getRepository(Organization).update(partner.id, { industry: "", status: "approved" as any });
    const briefsBefore = await db.getRepository(Brief).findBy({ organizationId: partner.id });
    const contactsBefore = await db.getRepository(BriefContact).findBy({ briefId: briefsBefore[0].id });
    const receiptsBefore = await db.getRepository(PartnerImportRecord).findBy({ cohortId: cohort.id });
    const usersBefore = await db.getRepository(User).count();
    fixture.rows[0]["Opportunity title"] = "Unselected replacement title";
    const preview = await service.preview(updateInput(), actor);
    expect(preview).toMatchObject({ ready: true, updatedPartners: 1, updatedBriefs: 0, newPartners: 0, newUsers: 0, newBriefs: 0 });
    expect(preview.updates[0].changes).toEqual([{ field: "industry", label: "Partner industry", before: { industry: "" }, after: { industry: "Healthcare" } }]);
    const receipt = await service.apply({ ...updateInput(), previewHash: preview.previewHash }, actor);
    expect(receipt).toMatchObject({ updatedPartners: 1, updatedBriefs: 0, createdUsers: 0 });
    expect(cache.del).toHaveBeenLastCalledWith(`briefs:cohort:${cohort.id}:approved`);
    expect(await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).toMatchObject({ industry: "Healthcare", status: "approved", email: partner.email });
    expect(await db.getRepository(Brief).findBy({ organizationId: partner.id })).toEqual(briefsBefore);
    expect(await db.getRepository(BriefContact).findBy({ briefId: briefsBefore[0].id })).toEqual(contactsBefore);
    expect(await db.getRepository(PartnerImportRecord).findBy({ cohortId: cohort.id })).toEqual(receiptsBefore);
    expect(await db.getRepository(User).count()).toBe(usersBefore);
    expect((await db.getRepository(AuditLog).findOneByOrFail({ entityId: receipt.batchId })).metadata).toMatchObject({ updateFields: ["industry"], updatedPartners: 1 });
    expect(await service.preview(updateInput(), actor)).toMatchObject({ ready: true, updatedPartners: 0, updatedBriefs: 0, unchangedBriefs: 3 });
  });

  it("updates only checked brief fields, synchronizes paired fields, preserves blanks, and records revisions", async () => {
    const { partner } = await load();
    const first = await db.getRepository(Brief).findOneByOrFail({ sessionId: fixture.sessionId, opportunityNumber: 1 });
    await db.getRepository(Brief).update(first.id, { status: BriefStatus.APPROVED });
    fixture.rows[0]["The opportunity and who it affects"] = "A corrected opportunity description affecting the whole district.";
    fixture.rows[0]["Country lead notes"] = "";
    fixture.rows[0]["Opportunity title"] = "Do not replace this title";
    const request = updateInput(["description", "countryLeadNotes"]), preview = await service.preview(request, actor);
    expect(preview).toMatchObject({ ready: true, updatedPartners: 0, updatedBriefs: 1 });
    await service.apply({ ...request, previewHash: preview.previewHash }, actor);
    const updated = await db.getRepository(Brief).findOneByOrFail({ id: first.id });
    expect(updated).toMatchObject({ description: fixture.rows[0]["The opportunity and who it affects"], problemStatement: fixture.rows[0]["The opportunity and who it affects"], title: first.title, countryLeadNotes: first.countryLeadNotes, status: BriefStatus.APPROVED, fitScore: first.fitScore, currentVersion: first.currentVersion + 1 });
    expect(await db.getRepository(BriefRevision).findOneBy({ briefId: first.id })).toMatchObject({ actorId: actor.id, actorType: "staff", previousData: { description: first.description }, newData: { description: updated.description } });
    expect((await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).updatedAt).toEqual(partner.updatedAt);
  });

  it("rejects stale target data and changed field selections before any updates", async () => {
    const { partner } = await load();
    await db.getRepository(Organization).update(partner.id, { industry: "Old value" });
    const request = updateInput(), preview = await service.preview(request, actor);
    await db.getRepository(Organization).update(partner.id, { industry: "Staff correction" });
    await expect(service.apply({ ...request, previewHash: preview.previewHash }, actor)).rejects.toThrow("Refresh the preview");
    expect((await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).industry).toBe("Staff correction");
    const fresh = await service.preview(request, actor);
    await expect(service.apply({ ...updateInput(["city"]), previewHash: fresh.previewHash }, actor)).rejects.toThrow("Refresh the preview");
  });

  it("skips unmatched rows and requires explicit supported unique fields without creating records", async () => {
    const before = await db.getRepository(Organization).count();
    const preview = await service.preview(updateInput(), actor);
    expect(preview).toMatchObject({ ready: true, newPartners: 0, newBriefs: 0, updatedPartners: 0, unmatchedBriefs: 3 });
    await service.apply({ ...updateInput(), previewHash: preview.previewHash }, actor);
    expect(await db.getRepository(Organization).count()).toBe(before);
    for (const fields of [[], ["industry", "industry"], ["status"], ["__proto__"]]) await expect(service.preview({ ...updateInput(), updateFields: fields as any }, actor)).rejects.toThrow();
    await expect(service.preview({ ...input(), updateFields: ["industry"] }, actor)).rejects.toThrow("Update existing only");
  });

  it("blocks conflicting partner industries and removed source targets rather than guessing", async () => {
    const { partner } = await load();
    fixture.rows[2]["Sector"] = "Finance";
    expect((await service.preview(updateInput(), actor)).errors).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("Conflicting partner industry") })]));
    expect((await service.preview(updateInput(["title"]), actor)).ready).toBe(true);
    await db.getRepository(Organization).softDelete(partner.id);
    expect((await service.preview(updateInput(), actor)).errors.some(error => error.message.includes("removed"))).toBe(true);
  });

  it("uses specific Other industry detail and updates public-intake briefs by source identity without import receipts", async () => {
    fixture.rows.forEach(row => { row["Sector"] = "Other"; row["Sector (if Other)"] = "Telecommunication"; });
    const { partner } = await load();
    expect(partner.industry).toBe("Telecommunication");
    await db.getRepository(PartnerImportRecord).delete({ cohortId: cohort.id });
    await db.getRepository(Organization).update(partner.id, { industry: "Other" });
    const preview = await service.preview(updateInput(), actor);
    expect(preview).toMatchObject({ ready: true, updatedPartners: 1, unmatchedBriefs: 0 });
    await service.apply({ ...updateInput(), previewHash: preview.previewHash }, actor);
    expect((await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).industry).toBe("Telecommunication");
  });

  it("previews missing verticals without writes, creates once per cohort, assigns briefs and counts submitted rows", async () => {
    const preview = await service.preview(input(), actor);
    expect(preview.verticals).toEqual([expect.objectContaining({ name: "Healthcare", isNew: true, projectedBriefCount: 3, briefCap: 10, rows: [2, 3, 4] })]);
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id })).toBe(0);
    expect((await service.preview(input(), actor)).previewHash).toBe(preview.previewHash);
    const receipt = await service.apply({ ...input(), previewHash: preview.previewHash }, actor);
    expect(receipt.createdVerticals).toBe(1);
    const vertical = await db.getRepository(Vertical).findOneByOrFail({ cohortId: cohort.id });
    expect(vertical).toMatchObject({ name: "Healthcare", briefCount: 3, briefCap: 10, isActive: true });
    expect(await db.getRepository(Brief).countBy({ cohortId: cohort.id, verticalId: vertical.id })).toBe(3);
    const repeat = await service.preview(input(), actor);
    expect(repeat).toMatchObject({ ready: true, newBriefs: 0, verticals: [] });
    expect(await service.apply({ ...input(), previewHash: repeat.previewHash }, actor)).toMatchObject({ createdVerticals: 0 });
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id })).toBe(1);
  });

  it("reuses Health for Healthcare, preserves its settings, and never uses another cohort's vertical", async () => {
    const other = await db.getRepository(Cohort).save({ name: "Other " + randomUUID(), status: CohortStatus.ACTIVE });
    await db.getRepository(Vertical).save({ name: "Healthcare", cohortId: other.id });
    const health = await db.getRepository(Vertical).save({ name: "Health", cohortId: cohort.id, briefCap: 50, displayOrder: 8 });
    const preview = await service.preview(input(), actor);
    expect(preview.verticals).toEqual([expect.objectContaining({ id: health.id, name: "Health", sectors: ["Healthcare"], isNew: false })]);
    await service.apply({ ...input(), previewHash: preview.previewHash }, actor);
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id })).toBe(1);
    expect(await db.getRepository(Vertical).findOneByOrFail({ id: health.id })).toMatchObject({ briefCount: 3, briefCap: 50, displayOrder: 8 });
    expect(await db.getRepository(Brief).countBy({ cohortId: cohort.id, verticalId: health.id })).toBe(3);
  });

  it("updates Industry and Vertical independently, creates missing Other verticals, and preserves source receipts and content", async () => {
    const { partner } = await load();
    const before = await db.getRepository(Brief).find({ where: { organizationId: partner.id }, order: { id: "ASC" } });
    const original = before[0].verticalId;
    const receipts = await db.getRepository(PartnerImportRecord).findBy({ cohortId: cohort.id });
    const accountCount = await db.getRepository(User).count(), contactCount = await db.getRepository(BriefContact).count();
    fixture.rows.forEach(row => { row["Sector"] = "Other"; row["Sector (if Other)"] = "Telecommunication"; });
    const request = updateInput(["verticalId"]), preview = await service.preview(request, actor);
    expect(preview).toMatchObject({ ready: true, updatedPartners: 0, updatedBriefs: 3 });
    expect(preview.verticals).toEqual([expect.objectContaining({ name: "Telecommunication", isNew: true, projectedBriefCount: 3 })]);
    expect(preview.updates[0].changes[0]).toMatchObject({ field: "verticalId", beforeLabel: "Healthcare", afterLabel: "Telecommunication" });
    const receipt = await service.apply({ ...request, previewHash: preview.previewHash }, actor);
    expect(receipt).toMatchObject({ createdPartners: 0, createdUsers: 0, createdBriefs: 0, createdVerticals: 1, updatedBriefs: 3 });
    const target = await db.getRepository(Vertical).findOneByOrFail({ cohortId: cohort.id, name: "Telecommunication" });
    expect(target.briefCount).toBe(3);
    expect((await db.getRepository(Vertical).findOneByOrFail({ id: original })).briefCount).toBe(0);
    const after = await db.getRepository(Brief).find({ where: { organizationId: partner.id }, order: { id: "ASC" } });
    for (let index = 0; index < before.length; index++) {
      expect(after[index]).toEqual({ ...before[index], verticalId: target.id, currentVersion: before[index].currentVersion + 1, updatedAt: expect.any(Date) });
      expect(await db.getRepository(BriefRevision).findOneBy({ briefId: before[index].id })).toMatchObject({ previousData: { verticalId: original }, newData: { verticalId: target.id }, actorId: actor.id });
    }
    expect((await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).industry).toBe("Healthcare");
    expect(await db.getRepository(PartnerImportRecord).findBy({ cohortId: cohort.id })).toEqual(receipts);
    expect(await db.getRepository(User).count()).toBe(accountCount);
    expect(await db.getRepository(BriefContact).count()).toBe(contactCount);
    expect(await service.preview(request, actor)).toMatchObject({ updatedBriefs: 0, unchangedBriefs: 3 });
    expect(await service.preview(updateInput(["industry", "verticalId"]), actor)).toMatchObject({ updatedPartners: 1, updatedBriefs: 0 });
  });

  it("backfills empty verticals and industry together without changing approvals, and excludes drafts from capacity", async () => {
    const { partner } = await load();
    await db.getRepository(Organization).update(partner.id, { industry: "" });
    await db.getRepository(Brief).createQueryBuilder().update().set({ verticalId: null as any }).where("cohort_id = :id", { id: cohort.id }).execute();
    const draft = await db.getRepository(Brief).findOneByOrFail({ sessionId: fixture.sessionId, opportunityNumber: 1 });
    await db.getRepository(Brief).update(draft.id, { status: BriefStatus.DRAFT });
    fixture.rows.forEach(row => { row["Sector"] = "Education"; });
    const request = updateInput(["industry", "verticalId"]), preview = await service.preview(request, actor);
    expect(preview).toMatchObject({ ready: true, updatedPartners: 1, updatedBriefs: 3 });
    expect(preview.verticals[0]).toMatchObject({ name: "Education", projectedBriefCount: 2 });
    await service.apply({ ...request, previewHash: preview.previewHash }, actor);
    expect(await db.getRepository(Organization).findOneByOrFail({ id: partner.id })).toMatchObject({ industry: "Education" });
    expect((await db.getRepository(Brief).findOneByOrFail({ id: draft.id })).status).toBe(BriefStatus.DRAFT);
    expect((await db.getRepository(Vertical).findOneByOrFail({ cohortId: cohort.id, name: "Education" })).briefCount).toBe(2);
  });

  it("does not create verticals for unmatched update rows or when Vertical is not selected", async () => {
    const missing = await service.preview(updateInput(["verticalId"]), actor);
    expect(missing).toMatchObject({ ready: true, unmatchedBriefs: 3, verticals: [] });
    await service.apply({ ...updateInput(["verticalId"]), previewHash: missing.previewHash }, actor);
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id })).toBe(0);
    await load();
    fixture.rows.forEach(row => { row["Sector"] = "Education"; });
    const request = updateInput(["industry"]), preview = await service.preview(request, actor);
    expect(preview.verticals).toEqual([]);
    await service.apply({ ...request, previewHash: preview.previewHash }, actor);
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id, name: "Education" })).toBe(0);
  });

  it("blocks insufficient capacity using actual submitted counts instead of stale cached counts", async () => {
    await load();
    const health = await db.getRepository(Vertical).findOneByOrFail({ cohortId: cohort.id });
    const target = await db.getRepository(Vertical).save({ cohortId: cohort.id, name: "Education", briefCap: 3, briefCount: 0 });
    await db.getRepository(Brief).save({ title: "Existing submitted brief", description: "Existing", problemStatement: "Existing problem", expectedOutcomes: "Existing outcome", organizationId: (await db.getRepository(Organization).findOneByOrFail({ name: fixture.name })).id, cohortId: cohort.id, verticalId: target.id, status: BriefStatus.SUBMITTED });
    fixture.rows.forEach(row => { row["Sector"] = "Education"; });
    const request = updateInput(["verticalId"]), preview = await service.preview(request, actor);
    expect(preview.ready).toBe(false);
    expect(preview.errors.some(error => error.message.includes("exceeding its capacity"))).toBe(true);
    await expect(service.apply({ ...request, previewHash: preview.previewHash }, actor)).rejects.toThrow("conflicts");
    expect((await db.getRepository(Vertical).findOneByOrFail({ id: health.id })).briefCount).toBe(3);
  });

  it("requires refreshed previews when a vertical is created or renamed or its capacity changes", async () => {
    const first = await service.preview(input(), actor);
    const target = await db.getRepository(Vertical).save({ cohortId: cohort.id, name: "Healthcare", briefCap: 50 });
    await expect(service.apply({ ...input(), previewHash: first.previewHash }, actor)).rejects.toThrow("Refresh the preview");
    for (const patch of [{ name: "Health" }, { briefCap: 20 }]) {
      const preview = await service.preview(input(), actor);
      await db.getRepository(Vertical).update(target.id, patch);
      await expect(service.apply({ ...input(), previewHash: preview.previewHash }, actor)).rejects.toThrow("Refresh the preview");
    }
    expect(await db.getRepository(Brief).countBy({ cohortId: cohort.id })).toBe(0);
  });

  it("rejects inactive, deleted and ambiguous matching verticals rather than creating duplicates", async () => {
    const target = await db.getRepository(Vertical).save({ cohortId: cohort.id, name: "Healthcare", isActive: false });
    expect((await service.preview(input(), actor)).ready).toBe(false);
    await db.getRepository(Vertical).update(target.id, { isActive: true });
    await db.getRepository(Vertical).softDelete(target.id);
    expect((await service.preview(input(), actor)).ready).toBe(false);
    await db.getRepository(Vertical).restore(target.id);
    await db.getRepository(Vertical).save({ cohortId: cohort.id, name: "healthcare" });
    const preview = await service.preview(input(), actor);
    expect(preview.errors.some(error => error.message.includes("ambiguous"))).toBe(true);
  });

  it("does not overwrite a previously auto-created vertical after staff rename it", async () => {
    await load();
    const original = await db.getRepository(Vertical).findOneByOrFail({ cohortId: cohort.id });
    await db.getRepository(Vertical).update(original.id, { name: "Former sector" });
    const request = updateInput(["verticalId"]), preview = await service.preview(request, actor);
    expect(preview).toMatchObject({ ready: true, updatedBriefs: 3 });
    expect(preview.verticals[0]).toMatchObject({ name: "Healthcare", isNew: true });
    expect(preview.verticals[0].id).not.toBe(original.id);
    await service.apply({ ...request, previewHash: preview.previewHash }, actor);
    expect(await db.getRepository(Vertical).findOneByOrFail({ id: original.id })).toMatchObject({ name: "Former sector", briefCount: 0 });
    expect(await db.getRepository(Vertical).countBy({ cohortId: cohort.id })).toBe(2);
  });
});
