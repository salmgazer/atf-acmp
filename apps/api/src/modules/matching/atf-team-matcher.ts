import { canShareTeam, hasNonComputingStudy, isQualifiedBuilder, normalizeTeamCountry, sectorStudyMatch, type TeamRuleParticipant } from "@acmp/shared";

// Lexicographic priorities: sectors, role coverage, country, then mix.
export function compareMatchingCandidates(members: TeamRuleParticipant[], a: TeamRuleParticipant, b: TeamRuleParticipant, targetSize = 5): number {
  const score = (candidate: TeamRuleParticipant) => {
    const first = members[0]?.preference?.firstChoiceSector;
    const sameFirst = members.filter(member => member.preference?.firstChoiceSector === candidate.preference?.firstChoiceSector).length;
    const backup = members.filter(member => member.preference?.backupSector === candidate.preference?.firstChoiceSector || member.preference?.firstChoiceSector === candidate.preference?.backupSector).length;
    const builders = members.filter(isQualifiedBuilder).length;
    const builderNeed = isQualifiedBuilder(candidate) && builders < (targetSize >= 4 ? 2 : 1) ? 1 : 0;
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
export function selectAtfTeam(pool: TeamRuleParticipant[], maximum = 5): TeamRuleParticipant[] {
  const target = Math.min(maximum, pool.length);
  const builders = pool.filter(isQualifiedBuilder).sort((a, b) => a.id.localeCompare(b.id));
  for (const builder of builders) {
    const members = [builder];
    if (!hasNonComputingStudy(builder)) {
      const nonComputing = pool.filter(p => p.id !== builder.id && hasNonComputingStudy(p) && canShareTeam([builder, p])).sort((a, b) => compareMatchingCandidates(members, a, b, target))[0];
      if (!nonComputing) continue;
      members.push(nonComputing);
    }
    while (members.length < target) {
      const candidates = pool.filter(candidate => !members.some(member => member.id === candidate.id) && canShareTeam([...members, candidate]));
      if (!candidates.length) break;
      // Keep one builder/non-computing participant available for each remaining
      // potential team, where another compatible candidate can fill this slot.
      const unused = pool.filter(candidate => !members.some(member => member.id === candidate.id));
      const remainingTeams = Math.floor((pool.length - target) / 3);
      const spareBuilders = unused.filter(isQualifiedBuilder).length;
      const spareNonComputing = unused.filter(hasNonComputingStudy).length;
      const reserved = candidates.filter(candidate => !(isQualifiedBuilder(candidate) && spareBuilders <= remainingTeams) && !(hasNonComputingStudy(candidate) && spareNonComputing <= remainingTeams));
      const choices = reserved.length ? reserved : candidates;
      choices.sort((a, b) => compareMatchingCandidates(members, a, b, target));
      members.push(choices[0]);
    }
    if (members.length >= 3) return members;
  }
  return [];
}
export function formAtfTeams(pool: TeamRuleParticipant[], maximum = 5): { teams: TeamRuleParticipant[][]; unassigned: TeamRuleParticipant[] } {
  let remaining = [...pool]; const teams: TeamRuleParticipant[][] = [];
  const groups = [...new Set(remaining.map(p => p.group || null))].sort();
  for (const group of groups) {
    let available = remaining.filter(p => (p.group || null) === group);
    while (available.length >= 3) {
      const remainder = available.length % maximum;
      const target = available.length > maximum && (remainder === 1 || remainder === 2) ? Math.max(3, maximum - (3 - remainder)) : maximum;
      const team = selectAtfTeam(available, target);
      if (!team.length) break;
      const selected = new Set(team.map(p => p.id));
      teams.push(team); available = available.filter(p => !selected.has(p.id)); remaining = remaining.filter(p => !selected.has(p.id));
    }
  }
  return { teams, unassigned: remaining };
}

// Display-only guide. Selection uses the ordered comparisons above.
export function matchingGuideScore(members: TeamRuleParticipant[]): number {
  if (!members.length) return 0;
  const firstChoices = new Map<string, number>();
  for (const member of members) { const sector = member.preference?.firstChoiceSector; if (sector) firstChoices.set(sector, (firstChoices.get(sector) || 0) + 1); }
  const sector = Math.max(0, ...firstChoices.values()) / members.length;
  const builderTarget = members.length >= 4 ? 2 : 1;
  const builders = Math.min(1, members.filter(isQualifiedBuilder).length / builderTarget);
  const specialist = members.some(p => p.preference?.preferredRole === "sector_specialist") ? 1 : 0;
  const impact = members.some(p => p.preference?.preferredRole === "business_impact_lead") ? 1 : 0;
  const sameCountry = new Set(members.map(p => normalizeTeamCountry(p.country))).size === 1 ? 1 : 0;
  const female = members.some(p => /^(female|woman|f)$/i.test(p.gender || "")) ? 1 : 0;
  const institutions = new Set(members.map(p => p.institution?.trim().toLowerCase()).filter(Boolean)).size > 1 ? 1 : 0;
  return Math.round(sector * 50 + ((builders + specialist + impact) / 3) * 30 + sameCountry * 10 + female * 5 + institutions * 5);
}
