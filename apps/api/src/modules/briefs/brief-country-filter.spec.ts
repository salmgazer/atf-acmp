import "reflect-metadata";
import { BriefsService } from "./briefs.service";
import { BriefStatus } from "@/database/entities/brief.entity";

describe("Brief country and pending-review filters", () => {
  function fixture() {
    const repository = { findAndCount: jest.fn(async (_options: any) => [[], 0]) };
    const service: BriefsService = Object.assign(Object.create(BriefsService.prototype), { briefRepository: repository });
    return { service, repository };
  }
  it("preserves cohort, organization, search and status constraints on both country branches before pagination", async () => {
    const { service, repository } = fixture();
    await service.findAll({ cohortId: "cohort", organizationId: "partner", search: "health", status: BriefStatus.SUBMITTED, country: " GH ", page: 2, limit: 100 });
    const query = repository.findAndCount.mock.calls[0][0];
    expect(query).toMatchObject({ skip: 100, take: 100 });
    expect(query.where).toHaveLength(2);
    for (const branch of query.where) expect(branch).toMatchObject({ cohortId: "cohort", organizationId: "partner", status: "submitted", title: expect.anything() });
    expect(query.where[0].problemCountry.getSql("country")).toBe("LOWER(BTRIM(country)) IN (:...briefCountryValues)");
    expect(query.where[0].problemCountry.objectLiteralParameters).toEqual({ briefCountryValues: ["gh", "ghana"] });
    expect(query.where[1].problemCountry.getSql("country")).toBe("NULLIF(BTRIM(country), '') IS NULL");
    expect(query.where[1].organization.country.objectLiteralParameters).toEqual({ briefCountryValues: ["gh", "ghana"] });
  });
  it.each(["Kenya", "ke", " KENYA "])("matches country codes and names without partial/wildcard matching (%s)", async country => {
    const { service, repository } = fixture();
    await service.findAll({ country });
    expect(repository.findAndCount.mock.calls[0][0].where[0].problemCountry.objectLiteralParameters.briefCountryValues).toEqual(["ke", "kenya"]);
  });
  it("binds arbitrary country input as data, not SQL", async () => {
    const { service, repository } = fixture();
    const country = "Kenya' OR 1=1 --";
    await service.findAll({ country });
    const operator = repository.findAndCount.mock.calls[0][0].where[0].problemCountry;
    expect(operator.getSql("country")).not.toContain(country);
    expect(operator.objectLiteralParameters.briefCountryValues).toEqual([country.toLowerCase()]);
  });
  it("filters pending statuses on the server instead of after a page has been loaded", async () => {
    const { service, repository } = fixture();
    await service.findAll({ country: "Nigeria", pendingReview: true, limit: 100 });
    for (const branch of repository.findAndCount.mock.calls[0][0].where) expect(branch.status.value).toEqual(["submitted", "in_review"]);
  });
  it("leaves existing queries and literal false pending flags unchanged", async () => {
    const { service, repository } = fixture();
    await service.findAll({ cohortId: "cohort", country: " ", pendingReview: false, status: BriefStatus.APPROVED });
    expect(repository.findAndCount.mock.calls[0][0].where).toEqual({ cohortId: "cohort", status: "approved" });
  });
  it("cannot use pending-review filtering to override an approved-only authorization scope", async () => {
    const { service, repository } = fixture();
    await service.findAll({ cohortId: "own-cohort", status: BriefStatus.APPROVED, pendingReview: true });
    expect(repository.findAndCount.mock.calls[0][0].where).toMatchObject({ cohortId: "own-cohort" });
    expect(repository.findAndCount.mock.calls[0][0].where.status.value).toEqual([]);
  });
  it("applies the same country precedence to statistics", async () => {
    const qb: any = { getRawMany: jest.fn(async () => [{ status: "submitted", count: "2" }, { status: "approved", count: "1" }]) };
    for (const name of ["select", "addSelect", "where", "groupBy", "leftJoin", "andWhere"]) qb[name] = jest.fn(() => qb);
    const service: BriefsService = Object.assign(Object.create(BriefsService.prototype), { briefRepository: { createQueryBuilder: () => qb } });
    expect(await service.getStatistics("cohort", "KE")).toMatchObject({ total: 3, submitted: 2, approved: 1 });
    expect(qb.where).toHaveBeenCalledWith("brief.cohort_id = :cohortId", { cohortId: "cohort" });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining("COALESCE(NULLIF(BTRIM(brief.problem_country), ''), organization.country)"), { briefCountryValues: ["ke", "kenya"] });
  });
});
