import "reflect-metadata";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import * as path from "path";
import { Organization, OrganizationStatus, OrganizationUser } from "@/database/entities/organization.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { OrganizationsService } from "@/modules/organizations/organizations.service";
import { PartnerInvitesService } from "@/modules/organizations/partner-invites.service";
import { PartnerInvitesProcessor } from "@/modules/organizations/partner-invites.processor";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Partner invitation eligibility and delivery", () => {
  let db: DataSource;
  let cohort: Cohort;
  let service: OrganizationsService;
  let email: { sendOrganizationInvite: jest.Mock; requireDeliveryConfiguration: jest.Mock };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize();
    await db.runMigrations();
    cohort = await db.getRepository(Cohort).save({ name: "Partner invitation regression", status: CohortStatus.ACTIVE });
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(() => {
    email = { sendOrganizationInvite: jest.fn(async () => true), requireDeliveryConfiguration: jest.fn() };
    service = new OrganizationsService(db.getRepository(Organization), db.getRepository(OrganizationUser), db.getRepository(User), db.getRepository(Vertical), email as any);
  });
  const fixture = (values: Partial<Organization> = {}) => db.getRepository(Organization).save({ name: "Partner", email: `${randomUUID()}@example.test`, status: OrganizationStatus.APPROVED, isActive: true, cohortId: cohort.id, ...values });
  const queue = () => ({ add: jest.fn(async (_name: string, _data: any) => ({ id: randomUUID() })) });

  it("rejects pending, rejected, inactive, deleted and missing selections atomically", async () => {
    const approved = await fixture(), pending = await fixture({ status: OrganizationStatus.PENDING }), rejected = await fixture({ status: OrganizationStatus.REJECTED }), inactive = await fixture({ isActive: false }), deleted = await fixture();
    await db.getRepository(Organization).softDelete(deleted.id);
    const jobs = queue(), bulk = new PartnerInvitesService(db.getRepository(Organization), jobs as any, email as any);
    for (const id of [pending.id, rejected.id, inactive.id, deleted.id, randomUUID()]) await expect(bulk.resendSelected([approved.id, id], "manager")).rejects.toThrow("Only approved");
    expect(jobs.add).not.toHaveBeenCalled();
    expect(await bulk.resendSelected([approved.id], "manager")).toMatchObject({ total: 1 });
  });

  it("selects all eligible partners by cohort, name search and country across pages", async () => {
    const marker = randomUUID(), first = await fixture({ name: marker, country: "GH" }), second = await fixture({ name: marker, country: "GH" });
    await fixture({ name: marker, country: "NG" });
    await fixture({ name: marker, country: "GH", status: OrganizationStatus.PENDING });
    await fixture({ name: marker, country: "GH", isActive: false });
    const deleted = await fixture({ name: marker, country: "GH" });
    await db.getRepository(Organization).softDelete(deleted.id);
    const other = await db.getRepository(Cohort).save({ name: "Other partner cohort", status: CohortStatus.ACTIVE });
    await fixture({ name: marker, country: "GH", cohortId: other.id });
    const jobs = queue(), bulk = new PartnerInvitesService(db.getRepository(Organization), jobs as any, email as any);
    expect(await bulk.resendEligible({ cohortId: cohort.id, search: marker, country: "GH" }, "manager")).toMatchObject({ total: 2 });
    expect(jobs.add.mock.calls[0][1].organizationIds.sort()).toEqual([first.id, second.id].sort());
    expect(await bulk.resendEligible({ cohortId: cohort.id, search: marker }, "manager")).toMatchObject({ total: 3 });
  });

  it("single and legacy bulk endpoints cannot invite ineligible partners", async () => {
    const approved = await fixture(), pending = await fixture({ status: OrganizationStatus.PENDING }), rejected = await fixture({ status: OrganizationStatus.REJECTED }), inactive = await fixture({ isActive: false });
    for (const item of [pending, rejected, inactive]) await expect(service.sendInvite(item.id)).rejects.toThrow("approved, active");
    expect(await service.bulkSendInvites([approved.id, pending.id, randomUUID()])).toMatchObject({ totalProcessed: 3, successCount: 1, failureCount: 2 });
    expect(email.sendOrganizationInvite).toHaveBeenCalledTimes(1);
    expect(email.sendOrganizationInvite).toHaveBeenCalledWith(approved.name, approved.email, undefined, true);
  });

  it("worker uses current email without changing credentials and skips deactivated recipients", async () => {
    const partner = await fixture(), corrected = `${randomUUID()}@example.test`;
    await db.getRepository(Organization).update(partner.id, { email: corrected });
    const user = await db.getRepository(User).save({ email: corrected, role: Role.ORGANIZATION, isActive: true, passwordHash: "unchanged-test-hash" });
    const worker = new PartnerInvitesProcessor(db.getRepository(Organization), service);
    const job = { data: { organizationIds: [partner.id], requestedBy: "manager" }, progress: 0, updateProgress: jest.fn() } as any;
    expect(await worker.process(job)).toMatchObject({ sent: 1, skipped: 0 });
    expect(email.sendOrganizationInvite).toHaveBeenCalledWith(partner.name, corrected, undefined, true);
    expect((await db.getRepository(User).findOneOrFail({ where: { id: user.id }, select: { passwordHash: true } })).passwordHash).toBe("unchanged-test-hash");
    await db.getRepository(Organization).update(partner.id, { isActive: false });
    expect(await worker.process(job)).toMatchObject({ sent: 0, skipped: 1 });
    expect(email.sendOrganizationInvite).toHaveBeenCalledTimes(1);
  });
});
