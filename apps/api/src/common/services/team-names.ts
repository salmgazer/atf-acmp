import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Team } from '@/database/entities/team.entity';

export const TEAM_NAME_TAKEN = 'A team with this name already exists in this cohort. Please choose another name.';

export function cleanTeamName(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value;
}

export function validateTeamName(value: unknown): string {
  const name = cleanTeamName(value);
  if (typeof name !== 'string' || [...name].length < 2 || [...name].length > 100) {
    throw new BadRequestException('Team names must contain between 2 and 100 characters.');
  }
  return name;
}

export function teamNameKey(name: string): string {
  return (cleanTeamName(name) as string).toLowerCase();
}

/** Reserve within this preview as well as against every existing, non-deleted team. */
export function availableTeamName(base: string, taken: Set<string>): string {
  base = validateTeamName(base);
  let candidate = base, suffix = 2;
  const match = /^Team (\d+)$/i.exec(base);
  let number = match ? Number(match[1]) : 0;
  const numbered = match && Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER - 1000000;
  while (taken.has(teamNameKey(candidate))) {
    const ending = ` (${suffix++})`;
    candidate = numbered ? `Team ${++number}` : `${[...base].slice(0, 100 - ending.length).join('')}${ending}`;
  }
  taken.add(teamNameKey(candidate));
  return candidate;
}

export function isTeamNameConflict(error: unknown): boolean {
  const driver = (error as { driverError?: { code?: string; constraint?: string } })?.driverError;
  return driver?.code === '23505' && driver.constraint === 'team_names_cohort_key';
}

/** A savepoint lets an automatic run recover when a manual creator claims a name meanwhile. */
export async function saveAutomaticallyNamedTeam(repository: Repository<Team>, team: Team): Promise<Team> {
  const base = team.name;
  for (let attempt = 0; attempt < 20; attempt++) {
    const existing = await repository.find({ where: { cohortId: team.cohortId }, select: { name: true } });
    team.name = availableTeamName(base, new Set(existing.map(row => teamNameKey(row.name))));
    try {
      return await repository.manager.transaction(manager => manager.getRepository(Team).save(team));
    } catch (error) {
      if (!isTeamNameConflict(error)) throw error;
    }
  }
  throw new ConflictException('Team names changed during formation. Run a fresh preview and try again.');
}
