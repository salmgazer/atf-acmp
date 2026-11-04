import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Organization, OrganizationUser, OrganizationUserRole } from "@/database/entities/organization.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Brief } from "@/database/entities/brief.entity";
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

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Partner submission imports with PostgreSQL", () => {
  let db: DataSource, service: SubmissionImportService, cohort: Cohort, actor: User;
  let fixture: ReturnType<typeof submissionFixture>;
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations(); service = new SubmissionImportService(db);
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
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
    expect(partner).toMatchObject({ status: "pending", publicSubmission: false, consentGiven: false });
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
    expect(partner).toMatchObject({ publicSubmission: true, consentGiven: true, status: "pending" });
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
});
