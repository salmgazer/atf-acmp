import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Organization } from "@/database/entities/organization.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { BriefsService } from "@/modules/briefs/briefs.service";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Brief country filtering with PostgreSQL", () => {
  let db: DataSource;
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost", "postgres"].includes(url.hostname)) throw new Error("Disposable local regression database required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });

  it("uses problem country first, falls back only when blank, and scopes counts and pending pagination consistently", async () => {
    const cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    const partner = async (country: string) => db.getRepository(Organization).save({ name: country, email: `${randomUUID()}@example.test`, country, cohortId: cohort.id });
    const ghana = await partner("Ghana"), kenya = await partner("KE");
    const brief = async (organization: Organization, problemCountry: string | null, status: BriefStatus) => db.getRepository(Brief).save({ title: randomUUID(), description: "Country filter fixture", problemStatement: "A sufficiently detailed problem", expectedOutcomes: "A working solution", cohortId: cohort.id, organizationId: organization.id, problemCountry, status });
    const explicitKenya = await brief(ghana, "Kenya", BriefStatus.SUBMITTED);
    const fallbackGhana = await brief(ghana, null, BriefStatus.SUBMITTED);
    const blankGhana = await brief(ghana, " ", BriefStatus.IN_REVIEW);
    const explicitGhana = await brief(kenya, " gh ", BriefStatus.APPROVED);
    const fallbackKenya = await brief(kenya, "", BriefStatus.APPROVED);
    await brief(ghana, "Nigeria", BriefStatus.SUBMITTED);
    const service: BriefsService = Object.assign(Object.create(BriefsService.prototype), { briefRepository: db.getRepository(Brief) });
    const ghanaResults = await service.findAll({ cohortId: cohort.id, country: "Ghana" });
    expect(ghanaResults.data.map(b => b.id).sort()).toEqual([fallbackGhana.id, blankGhana.id, explicitGhana.id].sort());
    expect((await service.findAll({ cohortId: cohort.id, country: "KE" })).data.map(b => b.id).sort()).toEqual([explicitKenya.id, fallbackKenya.id].sort());
    const pending = await service.findAll({ cohortId: cohort.id, country: "GH", pendingReview: true, page: 1, limit: 1 });
    expect(pending).toMatchObject({ total: 2, totalPages: 2 });
    expect(pending.data).toHaveLength(1);
    expect([BriefStatus.SUBMITTED, BriefStatus.IN_REVIEW]).toContain(pending.data[0].status);
    expect(await service.getStatistics(cohort.id, "ghana")).toMatchObject({ total: 3, submitted: 1, inReview: 1, approved: 1 });
    expect((await service.findAll({ cohortId: cohort.id, country: "Gha%" })).total).toBe(0);
  });
});
