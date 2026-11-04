import { BadRequestException } from '@nestjs/common';

export function normalizeGroups(groups: string[]): string[] {
  if (!Array.isArray(groups) || groups.length > 100 || groups.some(group => typeof group !== 'string' || !group.trim() || group.trim().length > 100)) throw new BadRequestException('Provide up to 100 group names of 1–100 characters');
  const names = groups.map(group => group.trim());
  if (new Set(names.map(group => group.toLowerCase())).size !== names.length) throw new BadRequestException('Group names must be unique');
  return names;
}

export function resolveCohortGroup(cohort: { groups?: string[] }, group?: string | null): string | null {
  const groups = cohort.groups || [];
  if (!groups.length) {
    if (group) throw new BadRequestException('This cohort has no groups');
    return null;
  }
  const match = typeof group === 'string' ? groups.find(name => name.toLowerCase() === group.trim().toLowerCase()) : undefined;
  if (!match) throw new BadRequestException('Select a group belonging to this cohort');
  return match;
}
