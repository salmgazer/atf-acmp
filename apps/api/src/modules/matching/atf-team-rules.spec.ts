import { evaluateTeamRules, hasNonComputingStudy, isQualifiedBuilder, type TeamRuleParticipant } from "@acmp/shared";
import { compareMatchingCandidates, formAtfTeams } from "./atf-team-matcher";
const now = new Date("2026-11-07T12:00:00Z");
const cohort = { id: "cohort", status: "active", groups: ["A", "B"], teamRuleDeadlines: { joining: "2026-11-13T23:59:59.999Z", certification: "2026-11-27T23:59:59.999Z" } };
const person = (id: string, changes: Partial<TeamRuleParticipant> = {}): TeamRuleParticipant => ({ id, cohortId: cohort.id, group: "A", country: "Ghana", status: "ready", onboardingComplete: true, learningHalfwayReached: true, fieldOfStudy: "Computer Science", pythonSkill: "Beginner", preference: { matchingProfileCompletedAt: now.toISOString(), crossCountryWilling: false, buildDeployAbility: "with_support", firstChoiceSector: "health", backupSector: "education", preferredRole: "sector_specialist", teamStatus: "need_team" }, ...changes });
const builder = (id: string) => person(id, { pythonSkill: "Intermediate — I can write functions and work with libraries", preference: { ...person(id).preference, buildDeployAbility: "confident", preferredRole: "builder" } });
const baseline = () => [builder("builder"), person("specialist", { fieldOfStudy: "Medicine" }), person("impact", { preference: { ...person("impact").preference, preferredRole: "business_impact_lead" } })];
const report = (members = baseline(), extra = {}) => evaluateTeamRules(cohort, members, { competitionCountry: "Ghana", now, ...extra });

describe("ATF hard rules and matching priorities", () => {
  it.each(["Intermediate", "Advanced", "Expert"])("qualifies a confident %s Python builder", level => expect(isQualifiedBuilder({ ...builder("b"), pythonSkill: level })).toBe(true));
  it("requires confident build/deploy ability or separately verified CodeLabs evidence", () => {
    expect(isQualifiedBuilder(person("p", { pythonSkill: "Expert" }))).toBe(false);
    expect(isQualifiedBuilder(person("p", { codeLabsCompleted: true }))).toBe(true);
    expect(isQualifiedBuilder(person("p"))).toBe(false);
  });
  it.each(["Computer Science", "Information Technology", "Software Engineering", "Computer Engineering", "IT", "", "N/A", "Unknown"])("does not count %s as a confirmed non-computing field", field => expect(hasNonComputingStudy(person("p", { fieldOfStudy: field }))).toBe(false));
  it("admits 3–5 members with one builder and one non-computing member, while showing mix/role guidance", () => {
    expect(report()).toMatchObject({ canRegister: true, canStartChallenge: false, builderCount: 1, nonComputingCount: 1 });
    const four = report([...baseline(), person("four")]); expect(four.canRegister).toBe(true); expect(four.guidance).toContain("Aim for two builders in a team of 4 or 5");
    expect(report(baseline().slice(0, 2)).registrationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "size" })]));
    expect(report([...baseline(), person("4"), person("5"), person("6")]).canRegister).toBe(false);
  });
  it("blocks opt-outs, missing halfway status, incomplete matching and missing hard role coverage", () => {
    for (const changes of [{ programmeOptedOut: true }, { learningHalfwayReached: false }, { onboardingComplete: false }]) expect(report([{ ...baseline()[0], ...changes }, ...baseline().slice(1)]).canRegister).toBe(false);
    expect(report(baseline().map(p => ({ ...p, fieldOfStudy: "Computer Science" }))).canRegister).toBe(false);
    expect(report(baseline().map(p => ({ ...p, pythonSkill: "Beginner" }))).canRegister).toBe(false);
  });
  it("normalizes country codes and requires every cross-country member's opt-in while retaining group boundaries", () => {
    expect(report([{ ...baseline()[0], country: "GH" }, ...baseline().slice(1)]).canRegister).toBe(true);
    const mixed = baseline().map((p, index) => ({ ...p, country: index === 1 ? "Nigeria" : p.country }));
    expect(report(mixed).canRegister).toBe(false);
    const willing = mixed.map(p => ({ ...p, preference: { ...p.preference, crossCountryWilling: true } }));
    expect(report(willing).canRegister).toBe(true);
    expect(report([{ ...willing[0], group: "B" }, ...willing.slice(1)]).canRegister).toBe(false);
    expect(report(willing, { competitionCountry: "Kenya" }).canRegister).toBe(false);
    expect(report(willing, { hasBrief: true, problemCountry: "Kenya" }).canRegister).toBe(false);
    expect(report(willing, { hasBrief: true, problemCountry: "Kenya" }).competitionCountries).toEqual([]);
    expect(report(willing, { hasBrief: true, competitionCountry: "Nigeria", problemCountry: "NG" }).competitionCountries).toEqual(["Nigeria"]);
  });
  it("does not use fixed calendar dates or legacy cohort deadline copies when stages are missing", () => {
    const unconfigured = { ...cohort, teamRuleDeadlines: undefined, deadlines: { teamFormationEnd: "2099-12-31T23:59:59Z", learningCertificationEnd: "2099-12-31T23:59:59Z" } };
    const missing = evaluateTeamRules(unconfigured, baseline(), { competitionCountry: "Ghana", now });
    expect(missing).toMatchObject({ canRegister: false, canStartChallenge: false, joinDeadline: null, certificateDeadline: null });
    expect(missing.registrationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "joining_stage" })]));
    expect(missing.challengeIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "certificate_deadline" })]));
    const laterCohort = { ...cohort, teamRuleDeadlines: { joining: "2032-06-20T16:00:00Z", certification: "2032-07-08T18:00:00Z" } };
    expect(evaluateTeamRules(laterCohort, baseline(), { competitionCountry: "Ghana", now: new Date("2032-06-19T00:00:00Z") }).canRegister).toBe(true);
  });

  it("enforces the joining cutoff, but preserves a timely registration for later challenge start", () => {
    expect(report(undefined, { now: new Date("2026-11-13T23:59:59.999Z") }).canRegister).toBe(true);
    expect(report(undefined, { now: new Date("2026-11-14T00:00:00Z") }).canRegister).toBe(false);
    expect(report(undefined, { now: new Date("2026-11-14T00:00:00Z"), registeredAt: now }).canRegister).toBe(true);
  });
  it("requires all 40 lessons, issued certificates and IDs, and checks the certification deadline rather than delaying start until it", () => {
    const certified = baseline().map(p => ({ ...p, learningFinishedAllLessons: true, learningCertificateIssued: true, learningCertificateId: `cert-${p.id}`, learningCertificateDate: "2026-11-06" }));
    const options = { hasBrief: true, problemCountry: "Ghana", registeredAt: now };
    expect(report(certified, options).canStartChallenge).toBe(true);
    expect(report([{ ...certified[0], learningFinishedAllLessons: false }, ...certified.slice(1)], options).canStartChallenge).toBe(false);
    expect(report(certified, { ...options, now: new Date("2026-12-01T00:00:00Z") }).canStartChallenge).toBe(true);
    expect(report([{ ...certified[0], learningCertificateDate: "2026-11-28" }, ...certified.slice(1)], { ...options, now: new Date("2026-12-01T00:00:00Z") }).canStartChallenge).toBe(false);
  });
  it("ranks common first sector before backup, role coverage before country, and country before mix", () => {
    const seed = builder("seed"), base = person("local");
    const primary = person("foreign-primary", { country: "Kenya", preference: { ...base.preference, firstChoiceSector: "health" } });
    const secondary = person("local-backup", { preference: { ...base.preference, firstChoiceSector: "education", backupSector: "health" } });
    expect(compareMatchingCandidates([seed], primary, secondary)).toBeLessThan(0);
    const impact = person("foreign-impact", { country: "Kenya", preference: { ...base.preference, preferredRole: "business_impact_lead" } });
    const specialistPresent = person("existing", { fieldOfStudy: "Medicine" });
    expect(compareMatchingCandidates([seed, specialistPresent], impact, base, 3)).toBeLessThan(0);
  });
  it.each([6, 7, 8, 9, 10, 11])("forms valid teams from %s participants without sacrificing required builders", size => {
    const people = Array.from({ length: size }, (_, index) => index < Math.ceil(size / 5) ? { ...builder(`b-${index}`), fieldOfStudy: "Mathematics" } : person(`p-${index}`));
    const formed = formAtfTeams(people);
    expect(formed.unassigned).toHaveLength(0);
    for (const team of formed.teams) expect(report(team).canRegister).toBe(true);
  });
  it("never teams people across groups or countries without mutual opt-in", () => {
    const people = [...baseline(), ...baseline().map(p => ({ ...p, id: p.id + "-other", group: "B", country: "Nigeria" }))];
    const formed = formAtfTeams(people); expect(formed.teams).toHaveLength(2);
    for (const team of formed.teams) { expect(new Set(team.map(p => p.group)).size).toBe(1); expect(new Set(team.map(p => p.country)).size).toBe(1); }
  });
});
