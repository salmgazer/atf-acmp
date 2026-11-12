import { NotFoundException } from "@nestjs/common";
import { COUNTRY_NAMES, normalizeTeamCountry } from "@acmp/shared";
import { EntityManager } from "typeorm";
import { Participant } from "@/database/entities/participant.entity";
import { TeamMember, TeamMemberStatus } from "@/database/entities/team.entity";

type CountryBrief = { cohortId?: string; problemCountry?: string | null; organization?: { country?: string | null } | null };
type CountryMember = { status?: string; participant?: { country?: string | null; cohortId?: string } | null };

export function briefCountry(brief: CountryBrief): string {
  return normalizeTeamCountry(brief.problemCountry?.trim() || brief.organization?.country);
}

export function confirmedTeamCountries(members: CountryMember[], cohortId?: string): string[] {
  return [...new Set(members.filter(member => member.status === "confirmed" && member.participant
    && (!cohortId || member.participant.cohortId === cohortId))
    .map(member => normalizeTeamCountry(member.participant!.country)).filter(Boolean))];
}

export function countryValues(value: string): string[] {
  const country = value.trim().toLowerCase();
  const match = Object.entries(COUNTRY_NAMES).find(([code, name]) => code.toLowerCase() === country || name.toLowerCase() === country);
  return match ? match.map(item => item.toLowerCase()) : [country];
}

export function isBriefCountryAllowed(brief: CountryBrief, countries: string[]): boolean {
  const country = briefCountry(brief).toLowerCase();
  return !!country && countries.some(value => normalizeTeamCountry(value).toLowerCase() === country);
}

/** Resolve from current confirmed membership, never from a caller-supplied team/country. */
export async function participantBriefScope(manager: EntityManager, participantId: string) {
  const participant = await manager.getRepository(Participant).findOne({ where: { id: participantId } });
  if (!participant) throw new NotFoundException("Participant not found");
  const membership = await manager.getRepository(TeamMember).findOne({
    where: { participantId, status: TeamMemberStatus.CONFIRMED, team: { cohortId: participant.cohortId } },
  });
  const members = membership ? await manager.getRepository(TeamMember).find({
    where: { teamId: membership.teamId, status: TeamMemberStatus.CONFIRMED }, relations: ["participant"],
  }) : [];
  const countries = membership ? confirmedTeamCountries(members, participant.cohortId)
    : [normalizeTeamCountry(participant.country)].filter(Boolean);
  return { cohortId: participant.cohortId, countries };
}

export const BRIEF_COUNTRY_SQL = "LOWER(BTRIM(COALESCE(NULLIF(BTRIM(brief.problem_country), ''), organization.country)))";
