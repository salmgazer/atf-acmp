import { resolveCohortTeamDeadlines } from "./cohort-team-deadlines";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ATF_TEAM_MAX, canShareTeam, evaluateTeamRules, normalizeTeamCountry, participantTeamIssues, type TeamRuleParticipant } from "@acmp/shared";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamMemberStatus, TeamRole, TeamStatus, TeamInvitation, InvitationStatus } from "@/database/entities/team.entity";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { briefCountry } from "./brief-country-access";

export async function teamRuleContext(manager: EntityManager, teamId: string) {
  const team = await manager.findOne(Team, { where: { id: teamId }, relations: ["cohort", "brief", "brief.organization", "members", "members.participant", "members.participant.preference"] });
  if (!team) throw new NotFoundException("Team not found");
  if (!team.cohort) throw new BadRequestException("The team cohort is no longer active");
  const members = team.members.filter(member => member.status === TeamMemberStatus.CONFIRMED).sort((a, b) => Number(b.role === TeamRole.LEAD) - Number(a.role === TeamRole.LEAD)).map(member => member.participant || Object.assign(new Participant(), { id: member.participantId, cohortId: team.cohortId, country: "", status: ParticipantStatus.INACTIVE, onboardingComplete: false }));
  await resolveCohortTeamDeadlines(manager, team.cohort);
  const problemCountry = team.brief ? briefCountry(team.brief) : undefined;
  const report = evaluateTeamRules(team.cohort, members, { competitionCountry: team.competitionCountry, problemCountry, hasBrief: !!team.briefId,
    registeredAt: team.registeredAt, challengeStartedAt: team.challengeStartedAt });
  if (team.briefId && (!team.brief || team.brief.status !== "approved")) {
    report.challengeIssues.push({ code: "brief_approval", message: "The assigned brief must still be approved" }); report.canStartChallenge = false;
  }
  if (team.status === TeamStatus.DISQUALIFIED) {
    const issue = { code: "disqualified", message: "Disqualified teams cannot register or start the challenge" };
    report.registrationIssues.push(issue); report.challengeIssues.push(issue); report.canRegister = false; report.canStartChallenge = false;
  }
  return { team, members, report };
}
export function assertJoiningWindow(cohort: Cohort) {
  if (cohort.status !== "active") throw new BadRequestException("Team formation requires an active cohort");
  const deadline = cohort.teamRuleDeadlines?.joining;
  if (!deadline) throw new BadRequestException("Staff must select a team-joining deadline stage for this cohort");
  if (!Number.isFinite(Date.parse(deadline)) || Date.now() > Date.parse(deadline)) throw new BadRequestException("The team joining and registration deadline has passed");
}
export async function assertParticipantTeamAdmission(manager: EntityManager, cohort: Cohort, participantId: string, members: TeamRuleParticipant[] = []) {
  await resolveCohortTeamDeadlines(manager, cohort);
  assertJoiningWindow(cohort);
  const participant = await manager.findOne(Participant, { where: { id: participantId }, relations: ["preference"] });
  if (!participant) throw new NotFoundException("Participant not found");
  const issues = participantTeamIssues(participant, cohort);
  if (issues.length) throw new BadRequestException(issues.map(issue => issue.message).join("; "));
  const roster = [...members.filter(member => member.id !== participant.id), participant];
  if (new Set(roster.map(member => member.group || null)).size > 1) throw new BadRequestException("Participants must belong to the same cohort group as the team");
  if (!canShareTeam(roster)) throw new BadRequestException("Cross-country teams require every member, including you, to opt in to cross-country teaming in their matching preferences");
  return participant;
}
export async function assertMemberAdmission(manager: EntityManager, teamId: string, participantId: string) {
  const { team, members } = await teamRuleContext(manager, teamId);
  if (team.status === TeamStatus.DISQUALIFIED) throw new BadRequestException("Disqualified teams cannot add members");
  if (!members.some(member => member.id === participantId) && members.length >= Math.min(ATF_TEAM_MAX, team.cohort.teamSizeMax || ATF_TEAM_MAX)) throw new BadRequestException("Team has reached maximum capacity");
  return assertParticipantTeamAdmission(manager, team.cohort, participantId, members);
}
export async function clearTeamRegistration(manager: EntityManager, teamId: string) {
  await manager.createQueryBuilder().update(Team).set({ registeredAt: null, challengeStartedAt: null, status: TeamStatus.FORMING }).where("id = :id AND status <> :disqualified", { id: teamId, disqualified: TeamStatus.DISQUALIFIED }).execute();
}
export async function assertChallengeStarted(manager: EntityManager, teamId: string) {
  const { team, report } = await teamRuleContext(manager, teamId);
  if (!team.challengeStartedAt || ![TeamStatus.ACTIVE, TeamStatus.SUBMITTED, TeamStatus.EVALUATED].includes(team.status) || !report.canStartChallenge) {
    throw new ForbiddenException("The team must register and pass all learning certificate checks before starting challenge work. " + report.challengeIssues.map(issue => issue.message).join("; "));
  }
}
export async function applyProgrammeOptOut(manager: EntityManager, participantId: string) {
  const memberships = await manager.find(TeamMember, { where: { participantId } });
  const teamIds = [...new Set(memberships.map(member => member.teamId))].sort();
  for (const teamId of teamIds) {
    await manager.query("SELECT id FROM teams WHERE id = $1 FOR UPDATE", [teamId]);
    await manager.delete(TeamMember, { teamId, participantId });
    const remaining = await manager.find(TeamMember, { where: { teamId, status: TeamMemberStatus.CONFIRMED }, order: { joinedAt: "ASC", id: "ASC" } });
    if (remaining.length && !remaining.some(member => member.role === TeamRole.LEAD)) await manager.update(TeamMember, remaining[0].id, { role: TeamRole.LEAD });
    await clearTeamRegistration(manager, teamId);
  }
  await manager.delete(TeamInvitation, { participantId, status: InvitationStatus.PENDING });
  // Revoke all programme chat memberships as well as the team roster entry.
  await manager.query("UPDATE channel_members SET left_at = NOW() WHERE member_id = $1 AND member_type = 'participant' AND left_at IS NULL", [participantId]);
  await manager.update(Participant, participantId, { status: ParticipantStatus.INACTIVE });
  await manager.update(RefreshToken, { participantId, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: "Programme opt-out" });
  return teamIds;
}
export const chooseCompetitionCountry = (members: TeamRuleParticipant[], briefCountry?: string | null) => {
  const preferred = normalizeTeamCountry(briefCountry);
  if (preferred && members.some(member => normalizeTeamCountry(member.country).toLowerCase() === preferred.toLowerCase())) return preferred;
  const counts = members.reduce((map, member) => { const country = normalizeTeamCountry(member.country); map.set(country, (map.get(country) || 0) + 1); return map; }, new Map<string, number>());
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
};
