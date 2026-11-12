import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { Reflector } from "@nestjs/core";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Organization } from "@/database/entities/organization.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamMemberStatus, TeamRole } from "@/database/entities/team.entity";
import { BriefsService } from "@/modules/briefs/briefs.service";
import { BriefsController } from "@/modules/briefs/briefs.controller";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { TeamsService } from "@/modules/teams/teams.service";
import { MatchingService } from "@/modules/matching/matching.service";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";
import { participantBriefScope } from "@/common/services/brief-country-access";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Confirmed team countries for brief browsing, ranking and assignment", () => {
  let db: DataSource, cohort: Cohort, team: Team, lead: Participant, members: Participant[], briefs: Brief[];
  let service: BriefsService, participants: ParticipantsService, teams: TeamsService, matching: MatchingService;
  const cache = { buildKey: (...args: string[]) => args.join(":"), get: jest.fn(), set: jest.fn() };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost", "postgres"].includes(url.hostname)) throw new Error("Disposable regression database required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    jest.clearAllMocks();
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    members = [];
    for (const country of ["Ghana", "NG", " Kenya ", "ZA"]) members.push(await db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", firstName: "Example", lastName: "Member", country, cohortId: cohort.id }));
    lead = members[0];
    team = await db.getRepository(Team).save({ name: "Mixed-country team", cohortId: cohort.id, competitionCountry: "Ghana", inviteCode: randomUUID().slice(0, 8) });
    for (const [index, participant] of members.entries()) await db.getRepository(TeamMember).save({ teamId: team.id, participantId: participant.id, role: index ? TeamRole.MEMBER : TeamRole.LEAD, status: TeamMemberStatus.CONFIRMED });
    const org = await db.getRepository(Organization).save({ name: "Ghana partner", email: randomUUID() + "@example.test", country: "Ghana", cohortId: cohort.id });
    briefs = [];
    for (const country of ["GH", "Nigeria", "ke", "South Africa", "Togo"]) briefs.push(await db.getRepository(Brief).save({ title: country + " problem", description: "A useful challenge", problemStatement: "A useful problem", expectedOutcomes: "A working solution", cohortId: cohort.id, organizationId: org.id, problemCountry: country, status: BriefStatus.APPROVED, maxTeams: 5 }));
    service = Object.assign(Object.create(BriefsService.prototype), { briefRepository: db.getRepository(Brief), cacheService: cache });
    participants = Object.assign(Object.create(ParticipantsService.prototype), { participantRepository: db.getRepository(Participant), preferenceRepository: db.getRepository("ParticipantPreference") });
    teams = Object.assign(Object.create(TeamsService.prototype), { teamRepository: db.getRepository(Team), memberRepository: db.getRepository(TeamMember), briefRepository: db.getRepository(Brief) });
    matching = Object.assign(Object.create(MatchingService.prototype), { teamRepository: db.getRepository(Team), briefRepository: db.getRepository(Brief) });
  });
  const ids = (rows: Brief[]) => rows.map(brief => brief.id).sort();

  it("gives every member the same four-country union, independent of lead or competition country and shared cache", async () => {
    cache.get.mockResolvedValue([briefs[4]]);
    for (const member of members) {
      expect(ids(await service.findApproved(cohort.id, undefined, undefined, member.id))).toEqual(ids(briefs.slice(0, 4)));
      expect(await participantBriefScope(db.manager, member.id)).toEqual({ cohortId: cohort.id, countries: expect.arrayContaining(["Ghana", "Nigeria", "Kenya", "South Africa"]) });
    }
    expect(cache.get).not.toHaveBeenCalled(); expect(cache.set).not.toHaveBeenCalled();
  });

  it("applies country scope before pagination and search, intersects explicit filters, and scopes statistics", async () => {
    const page = await service.findAll({ limit: 2, page: 1 }, lead.id);
    expect(page).toMatchObject({ total: 4, totalPages: 2 }); expect(page.data).toHaveLength(2);
    expect(ids((await service.findAll({ country: "NG" }, lead.id)).data)).toEqual([briefs[1].id]);
    expect((await service.findAll({ country: "Togo" }, lead.id)).total).toBe(0);
    expect(ids(await service.findApproved(cohort.id, undefined, "Nigeria", lead.id))).toEqual([briefs[1].id]);
    expect(await service.getStatistics(cohort.id, undefined, lead.id)).toMatchObject({ total: 4, approved: 4, draft: 0 });
  });

  it("does not count pending, removed or soft-deleted participants and refreshes when confirmation changes", async () => {
    await db.getRepository(TeamMember).update({ teamId: team.id, participantId: members[1].id }, { status: TeamMemberStatus.PENDING });
    await db.getRepository(TeamMember).softDelete({ teamId: team.id, participantId: members[2].id });
    await db.getRepository(Participant).softDelete(members[3].id);
    expect(ids(await service.findApproved(cohort.id, undefined, undefined, lead.id))).toEqual([briefs[0].id]);
    // An applicant sees only their own country until confirmed.
    expect(ids(await service.findApproved(cohort.id, undefined, undefined, members[1].id))).toEqual([briefs[1].id]);
    await db.getRepository(TeamMember).update({ teamId: team.id, participantId: members[1].id }, { status: TeamMemberStatus.CONFIRMED });
    expect(ids(await service.findApproved(cohort.id, undefined, undefined, lead.id))).toEqual(ids(briefs.slice(0, 2)));
  });

  it("uses the problem country first, with the partner country as a blank-country fallback", async () => {
    await db.getRepository(Brief).update(briefs[0].id, { problemCountry: " " });
    expect(ids(await service.findApproved(cohort.id, undefined, undefined, lead.id))).toContain(briefs[0].id);
    // An explicit foreign problem cannot borrow its Ghana partner's country.
    expect(ids(await service.findApproved(cohort.id, undefined, undefined, lead.id))).not.toContain(briefs[4].id);
  });

  it("protects direct detail/revision links and preserves staff access", async () => {
    const guard = new ResourceAccessGuard(new Reflector(), db);
    const context = (brief: Brief, role = "participant", handler = "findOne") => ({ getClass: () => BriefsController, getHandler: () => (BriefsController.prototype as any)[handler], switchToHttp: () => ({ getRequest: () => ({ user: { id: lead.id, role, cohortId: cohort.id }, method: "GET", params: { id: brief.id }, query: {} }) }) }) as any;
    await expect(guard.canActivate(context(briefs[1]))).resolves.toBe(true);
    await expect(guard.canActivate(context(briefs[4]))).rejects.toThrow("access");
    await expect(guard.canActivate(context(briefs[4], "participant", "getRevisionHistory"))).rejects.toThrow("access");
    await expect(guard.canActivate(context(briefs[4], "program_manager"))).resolves.toBe(true);
    await db.getRepository(Brief).update(briefs[1].id, { status: BriefStatus.DRAFT });
    await expect(guard.canActivate(context(briefs[1]))).rejects.toThrow("access");
  });

  it("accepts teammate-country rankings through both preference paths and rejects outside countries", async () => {
    expect((await participants.updateBriefRankings(lead.id, [briefs[1].id, briefs[2].id])).briefRankings).toEqual([briefs[1].id, briefs[2].id]);
    await expect(participants.savePreferences(lead.id, { briefRankings: [briefs[4].id] } as any)).rejects.toThrow("Rank only approved briefs");
    await expect(participants.updateBriefRankings(lead.id, [briefs[4].id])).rejects.toThrow("Rank only approved briefs");
    await participants.savePreferences(lead.id, { briefRankings: [briefs[3].id] } as any);
    await db.getRepository(TeamMember).softDelete({ teamId: team.id, participantId: members[3].id });
    await expect(participants.updateBriefRankings(lead.id, [briefs[3].id])).rejects.toThrow("Rank only approved briefs");
  });

  it("assigns a teammate-country brief manually and sets its competition country, preserving capacity", async () => {
    const registeredAt = new Date();
    await db.getRepository(Team).update(team.id, { registeredAt });
    const assigned = await teams.assignBrief(team.id, briefs[1].id);
    expect(assigned).toMatchObject({ briefId: briefs[1].id, competitionCountry: "Nigeria", registeredAt });
    await expect(teams.assignBrief(team.id, briefs[4].id)).rejects.toThrow("problem country");
    await db.getRepository(Brief).update(briefs[2].id, { maxTeams: 0 });
    await expect(teams.assignBrief(team.id, briefs[2].id)).rejects.toThrow("capacity");
    await db.getRepository(Brief).update(briefs[3].id, { status: BriefStatus.DRAFT });
    await expect(teams.assignBrief(team.id, briefs[3].id)).rejects.toThrow("not found");
  });

  it("revalidates automated assignments against the current roster and follows the selected brief country", async () => {
    const registeredAt = new Date();
    await db.getRepository(Team).update(team.id, { registeredAt });
    await (matching as any).assignBriefToTeam(team.id, briefs[2].id);
    expect(await db.getRepository(Team).findOneByOrFail({ id: team.id })).toMatchObject({ briefId: briefs[2].id, competitionCountry: "Kenya", registeredAt });
    await db.getRepository(Team).update(team.id, { briefId: null as any });
    await db.getRepository(TeamMember).softDelete({ teamId: team.id, participantId: members[3].id });
    await expect((matching as any).assignBriefToTeam(team.id, briefs[3].id)).rejects.toThrow("problem country");
  });

  it("does not expose cross-cohort or unapproved briefs even when given forged filters", async () => {
    const other = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    await db.getRepository(Brief).update(briefs[1].id, { cohortId: other.id });
    await db.getRepository(Brief).update(briefs[2].id, { status: BriefStatus.DRAFT });
    expect(ids(await service.findApproved(other.id, undefined, undefined, lead.id))).toEqual(ids([briefs[0], briefs[3]]));
    expect(ids((await service.findAll({ cohortId: other.id, status: BriefStatus.DRAFT }, lead.id)).data)).toEqual(ids([briefs[0], briefs[3]]));
    await expect(teams.assignBrief(team.id, briefs[1].id)).rejects.toThrow("not found");
  });
});
