import { canShareTeam, hasNonComputingStudy, countsAsFormationBuilder, formationBuilderStatus, DEFAULT_FORMATION_SETTINGS, type FormationSettings, normalizeTeamCountry, sectorStudyMatch, type TeamRuleParticipant } from "@acmp/shared";

// Lexicographic priorities: sectors, role coverage, country, then mix.
export function compareMatchingCandidates(members: TeamRuleParticipant[], a: TeamRuleParticipant, b: TeamRuleParticipant, targetSize = 5, policy: FormationSettings = DEFAULT_FORMATION_SETTINGS): number {
  const score = (candidate: TeamRuleParticipant) => {
    const first = members[0]?.preference?.firstChoiceSector;
    const sameFirst = members.filter(member => member.preference?.firstChoiceSector === candidate.preference?.firstChoiceSector).length;
    const backup = members.filter(member => member.preference?.backupSector === candidate.preference?.firstChoiceSector || member.preference?.firstChoiceSector === candidate.preference?.backupSector).length;
    const builders = members.filter(p => countsAsFormationBuilder(p, policy.builderEligibility)).length;
    const builderNeed = countsAsFormationBuilder(candidate, policy.builderEligibility) && builders < Math.max(policy.minimumBuilders, targetSize >= 4 ? policy.preferredBuilders : 1) ? 1 : 0;
    const specialistNeed = !members.some(member => member.preference?.preferredRole === "sector_specialist" && sectorStudyMatch(member, first)) && candidate.preference?.preferredRole === "sector_specialist" && sectorStudyMatch(candidate, first) ? 1 : 0;
    const impactNeed = !members.some(member => member.preference?.preferredRole === "business_impact_lead") && candidate.preference?.preferredRole === "business_impact_lead" ? 1 : 0;
    const sameCountry = members.filter(member => normalizeTeamCountry(member.country) === normalizeTeamCountry(candidate.country)).length;
    const female = !members.some(member => /^(female|woman|f)$/i.test(member.gender || "")) && /^(female|woman|f)$/i.test(candidate.gender || "") ? 1 : 0;
    const institution = candidate.institution?.trim().toLowerCase();
    const institutionMix = institution && !members.some(member => member.institution?.trim().toLowerCase() === institution) ? 1 : 0;
    return [sameFirst, backup, builderNeed + specialistNeed + impactNeed, sameCountry, female, institutionMix];
  };
  const sa = score(a), sb = score(b);
  for (let index = 0; index < sa.length; index++) if (sa[index] !== sb[index]) return sb[index] - sa[index];
  return a.id.localeCompare(b.id);
}
const builderRank = (p: TeamRuleParticipant) => ({ confirmed: 0, awaiting: 1, potential: 2, non_builder: 3 })[formationBuilderStatus(p)];
export function selectAtfTeam(pool: TeamRuleParticipant[], maximum = 5, policy: FormationSettings = { ...DEFAULT_FORMATION_SETTINGS, shortageAction: 'leave_unassigned' }, minimumSize = 3): TeamRuleParticipant[] {
  const target = Math.min(maximum, pool.length);
  const counts = (p: TeamRuleParticipant) => countsAsFormationBuilder(p, policy.builderEligibility);
  const seeds = pool.filter(p => policy.minimumBuilders === 0 || counts(p)).sort((a, b) => builderRank(a) - builderRank(b) || a.id.localeCompare(b.id));
  for (const seed of seeds) {
    const members = [seed];
    if (!hasNonComputingStudy(seed)) {
      const nonComputing = pool.filter(p => p.id !== seed.id && hasNonComputingStudy(p) && canShareTeam([seed, p])).sort((a, b) => compareMatchingCandidates(members, a, b, target, policy))[0];
      if (!nonComputing) continue;
      members.push(nonComputing);
    }
    while (members.length < target) {
      const candidates = pool.filter(candidate => !members.some(member => member.id === candidate.id) && canShareTeam([...members, candidate]));
      if (!candidates.length) break;
      const needsBuilder = members.filter(counts).length < policy.minimumBuilders;
      const required = needsBuilder ? candidates.filter(counts) : [];
      const unused = pool.filter(candidate => !members.some(member => member.id === candidate.id));
      const remainingTeams = Math.floor((pool.length - target) / minimumSize);
      // Reserve builders for other possible teams before adding extra builders.
      const spareBuilders = unused.filter(counts).length;
      const spareNonComputing = unused.filter(hasNonComputingStudy).length;
      const reserved = candidates.filter(candidate => !(counts(candidate) && spareBuilders <= remainingTeams * Math.max(1, policy.minimumBuilders)) && !(hasNonComputingStudy(candidate) && spareNonComputing <= remainingTeams));
      const choices = required.length ? required : reserved.length ? reserved : candidates;
      choices.sort((a, b) => required.length ? builderRank(a) - builderRank(b) || compareMatchingCandidates(members, a, b, target, policy) : compareMatchingCandidates(members, a, b, target, policy));
      members.push(choices[0]);
    }
    if (members.length >= minimumSize && members.filter(counts).length >= policy.minimumBuilders) return members;
  }
  return [];
}
export function formAtfTeams(pool: TeamRuleParticipant[], maximum = 5, policy: FormationSettings = { ...DEFAULT_FORMATION_SETTINGS, shortageAction: 'leave_unassigned' }, minimumSize = 3): { teams: TeamRuleParticipant[][]; unassigned: TeamRuleParticipant[] } {
  let remaining = [...pool]; const teams: TeamRuleParticipant[][] = [];
  const groups = [...new Set(remaining.map(p => p.group || null))].sort();
  const pass = (requirement: FormationSettings) => {
    for (const group of groups) {
      let available = remaining.filter(p => (p.group || null) === group);
      while (available.length >= minimumSize) {
        const remainder = available.length % maximum;
        const target = available.length > maximum && remainder > 0 && remainder < minimumSize ? Math.max(minimumSize, maximum - (minimumSize - remainder)) : maximum;
        const team = selectAtfTeam(available, target, requirement, minimumSize);
        if (!team.length) break;
        const selected = new Set(team.map(p => p.id));
        teams.push(team); available = available.filter(p => !selected.has(p.id)); remaining = remaining.filter(p => !selected.has(p.id));
      }
    }
  };
  pass(policy);
  if (policy.shortageAction !== 'leave_unassigned' && policy.minimumBuilders > 0) pass({ ...policy, minimumBuilders: 0 });
  return { teams, unassigned: remaining };
}

// Display-only guide. Selection uses the ordered comparisons above.
export function matchingGuideScore(members: TeamRuleParticipant[], policy: FormationSettings = DEFAULT_FORMATION_SETTINGS): number {
  if (!members.length) return 0;
  const firstChoices = new Map<string, number>();
  for (const member of members) { const sector = member.preference?.firstChoiceSector; if (sector) firstChoices.set(sector, (firstChoices.get(sector) || 0) + 1); }
  const sector = Math.max(0, ...firstChoices.values()) / members.length;
  const builderTarget = Math.max(policy.minimumBuilders, members.length >= 4 ? policy.preferredBuilders : 1);
  const builders = builderTarget > 0 ? Math.min(1, members.filter(p => countsAsFormationBuilder(p, policy.builderEligibility)).length / builderTarget) : 1;
  const specialist = members.some(p => p.preference?.preferredRole === "sector_specialist") ? 1 : 0;
  const impact = members.some(p => p.preference?.preferredRole === "business_impact_lead") ? 1 : 0;
  const sameCountry = new Set(members.map(p => normalizeTeamCountry(p.country))).size === 1 ? 1 : 0;
  const female = members.some(p => /^(female|woman|f)$/i.test(p.gender || "")) ? 1 : 0;
  const institutions = new Set(members.map(p => p.institution?.trim().toLowerCase()).filter(Boolean)).size > 1 ? 1 : 0;
  return Math.round(sector * 50 + ((builders + specialist + impact) / 3) * 30 + sameCountry * 10 + female * 5 + institutions * 5);
}
