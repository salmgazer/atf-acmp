import { TeamFormationService } from "./team-formation.service";
import { LeadSelectionStrategy } from "./dto/team-formation.dto";
import { createMockRepository, createMockQueryBuilder } from "../../../test/utils/test-utils";

// Repository orchestration, caching and admission boundaries. Actual writes,
// rollback and revalidation are exercised by the PostgreSQL lifecycle suite.
describe("ATF team formation previews", () => {
  const deadline = new Date(Date.now() + 86400000).toISOString();
  const cohort: any = { id: "cohort", name: "ATF cohort", status: "active", groups: ["A", "B"], teamSizeMin: 3, teamSizeMax: 5, teamJoiningStageId: "join-stage", learningCertificationStageId: "certificate-stage" };
  let service: TeamFormationService, teams: any, members: any, cohorts: any, people: any, preferences: any, briefs: any, query: any;
  const data = new Map<string, any>();
  const person = (id: string, group = "A", country = "Ghana") => ({ id, participantId: `LMS-${id}`, firstName: "Example", lastName: id, country, cohortId: "cohort", group, status: "ready", onboardingComplete: true, learningHalfwayReached: true, pythonSkill: "Intermediate", fieldOfStudy: "Medicine", skills: ["Python"], interests: [], createdAt: new Date() });
  const preference = (id: string, willing = false) => ({ participantId: id, buildDeployAbility: "confident", preferredRole: "builder", firstChoiceSector: "health", backupSector: "education", teamStatus: "need_team", matchingProfileCompletedAt: new Date(), crossCountryWilling: willing, briefRankings: [] });
  const load = (rows: any[], prefs = rows.map(p => preference(p.id))) => { query.getMany.mockResolvedValue(rows); preferences.find.mockResolvedValue(prefs); };
  beforeEach(() => {
    data.clear(); teams = createMockRepository(); members = createMockRepository(); cohorts = createMockRepository(); people = createMockRepository(); preferences = createMockRepository(); briefs = createMockRepository();
    teams.manager = { find: jest.fn(async () => [{ id: "join-stage", deadline: new Date(deadline), updatedAt: new Date(0) }, { id: "certificate-stage", deadline: new Date(Date.now() + 10 * 86400000), updatedAt: new Date(0) }]) };
    cohorts.findOneBy.mockResolvedValue(cohort); teams.find.mockResolvedValue([]); briefs.find.mockResolvedValue([]);
    const membershipQuery = createMockQueryBuilder(); membershipQuery.getRawMany.mockResolvedValue([]); members.createQueryBuilder.mockReturnValue(membershipQuery);
    query = createMockQueryBuilder(); people.createQueryBuilder.mockReturnValue(query); load([]);
    const cache = { get: async (key: string) => data.get(key), set: async (key: string, value: any) => { data.set(key, value); }, del: async (key: string) => { data.delete(key); } };
    service = new TeamFormationService(cache as any, teams, members, cohorts, people, preferences, briefs, createMockRepository(), {} as any, {} as any);
  });
  it("rejects missing/inactive cohorts and unconsented cross-country overrides", async () => {
    cohorts.findOneBy.mockResolvedValueOnce(null); await expect(service.runTeamFormation("cohort")).rejects.toThrow("Cohort not found");
    cohorts.findOneBy.mockResolvedValueOnce({ ...cohort, status: "archived" }); await expect(service.runTeamFormation("cohort")).rejects.toThrow("active cohort");
    await expect(service.runTeamFormation("cohort", { config: { forceCrossCountry: true } })).rejects.toThrow("cannot be overridden");
    await expect(service.runTeamFormation("cohort", { config: { teamSizeMax: 6 } })).rejects.toThrow("3 to 5");
  });
  it.each([false, true])("keeps group boundaries in both brief-assignment modes (%s)", async useBriefCentricAssignment => {
    const rows = [1, 2, 3].map(id => person(`a${id}`)).concat([1, 2, 3].map(id => person(`b${id}`, "B")), [person("ungrouped", "")]);
    load(rows); const preview = await service.runTeamFormation("cohort", { config: { useBriefCentricAssignment } });
    expect(preview.proposedTeams).toHaveLength(2); expect(preview.unassignedParticipantIds).toContain("ungrouped");
    for (const team of preview.proposedTeams) expect(new Set(team.participants.map(p => rows.find(r => r.id === p.id)!.group)).size).toBe(1);
  });
  it("does not combine undersized groups to make a team", async () => {
    load([person("a1"), person("a2"), person("b1", "B"), person("b2", "B")]);
    const preview = await service.runTeamFormation("cohort"); expect(preview.proposedTeams).toHaveLength(0); expect(preview.unassignedParticipantIds).toHaveLength(4);
  });
  it("excludes programme opt-outs, missing halfway data, full-team declarations and unanswered matching profiles", async () => {
    const rows = [person("opt"), person("half"), person("full"), person("missing")]; Object.assign(rows[0], { programmeOptedOut: true }); Object.assign(rows[1], { learningHalfwayReached: false });
    load(rows, [preference("opt"), preference("half"), { ...preference("full"), teamStatus: "full_team" }]);
    const preview = await service.runTeamFormation("cohort"); expect(preview.proposedTeams).toHaveLength(0); expect(preview.unassignedParticipantIds).toHaveLength(4); expect(preview.warnings.join(" ")).toContain("opted out");
  });
  it("requires all cross-country participants to opt in", async () => {
    const rows = [person("a"), person("b", "A", "Nigeria"), person("c", "A", "Nigeria")];
    load(rows); expect((await service.runTeamFormation("cohort")).proposedTeams).toHaveLength(0);
    load(rows, rows.map(p => preference(p.id, true))); expect((await service.runTeamFormation("cohort")).proposedTeams[0].isCrossCountry).toBe(true);
  });
  it("does not mistake technical skill tags for a qualified builder", async () => {
    const rows = [person("a"), person("b"), person("c")].map(p => ({ ...p, pythonSkill: "Beginner", skills: ["Python", "JavaScript"] }));
    load(rows); expect((await service.runTeamFormation("cohort")).proposedTeams).toHaveLength(0);
  });
  it("leaves role/mix guidance nonblocking and produces a current-policy cache receipt", async () => {
    load([person("a"), person("b"), person("c")]); const preview = await service.runTeamFormation("cohort");
    expect(preview.policyVersion).toBe("atf-2026-v3"); expect(preview.proposedTeams[0].eligibility).toMatchObject({ canRegister: true, femaleCount: 0 });
    expect(await service.getTeamFormationPreview("cohort")).toEqual(preview); await service.clearFormationPreviewCache("cohort"); expect(await service.getTeamFormationPreview("cohort")).toBeNull();
  });
  it("requires a fresh policy preview before finalization", async () => {
    await expect(service.finalizeTeamFormation("cohort")).rejects.toThrow("fresh"); data.set("formation:cohort", { policyVersion: "old" }); await expect(service.finalizeTeamFormation("cohort")).rejects.toThrow("fresh");
  });
  it("retains lead-selection choices without changing ATF admission/matching rules", async () => {
    const rows = [person("a"), { ...person("b"), skills: ["Python", "Design", "Writing"] }, person("c")]; load(rows);
    const preview = await service.runTeamFormation("cohort", { config: { leadSelectionStrategy: LeadSelectionStrategy.MOST_SKILLS } }); expect(preview.proposedTeams[0].leadParticipantId).toBe("b");
  });
  it("returns a helpful empty preview without writing teams or memberships", async () => {
    const preview = await service.runTeamFormation("cohort"); expect(preview.proposedTeams).toHaveLength(0); expect(preview.warnings.join(" ")).toContain("No eligible"); expect(teams.save).not.toHaveBeenCalled(); expect(members.save).not.toHaveBeenCalled();
  });
});
