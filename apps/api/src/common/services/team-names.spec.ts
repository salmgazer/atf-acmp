import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryFailedError } from 'typeorm';
import { availableTeamName, cleanTeamName, isTeamNameConflict, teamNameKey, validateTeamName, TEAM_NAME_TAKEN } from './team-names';
import { CreateTeamDto, UpdateTeamDto } from '@/modules/teams/dto/team.dto';
import { ManualTeamAssignmentDto } from '@/modules/matching/dto/team-formation.dto';
import { GlobalExceptionFilter } from '@/common/filters/http-exception.filter';

describe('Cohort team names', () => {
  it('ignores capitalization and extra Unicode whitespace without conflating punctuation', () => {
    expect(cleanTeamName(' \tImpact\u00a0  Nexus\n')).toBe('Impact Nexus');
    expect(teamNameKey(' impact NEXUS ')).toBe('impact nexus');
    expect(teamNameKey('Team-A')).not.toBe(teamNameKey('Team A'));
  });
  it.each(['', ' \t ', 'A', null, 42, 'x'.repeat(101)])('rejects invalid name %j', name => {
    expect(() => validateTeamName(name)).toThrow('between 2 and 100');
  });
  it('reserves distinct automatic names across repeated runs and inside a preview', () => {
    const taken = new Set(['team 1', 'team 2', 'team 4']);
    expect(availableTeamName('Team 1', taken)).toBe('Team 3');
    expect(availableTeamName('Team 2', taken)).toBe('Team 5');
    expect(availableTeamName('Team 3', taken)).toBe('Team 6');
  });
  it('keeps descriptive fallback names within the name limit', () => {
    const base = 'x'.repeat(100), taken = new Set([base]);
    const name = availableTeamName(base, taken);
    expect(name).toHaveLength(100); expect(name).toMatch(/ \(2\)$/);
  });
  it('normalizes manual names before DTO length validation, including optional formation names', async () => {
    const types: Array<new () => { name?: string }> = [CreateTeamDto, UpdateTeamDto];
    for (const type of types) {
      const dto = plainToInstance(type, { name: ' \tMy   team ' });
      expect(dto.name).toBe('My team');
      const invalid = plainToInstance(type, { name: ' \t ' });
      expect((await validate(invalid)).some(error => error.property === 'name')).toBe(true);
    }
    expect(plainToInstance(ManualTeamAssignmentDto, { teamName: '  ' }).teamName).toBeUndefined();
    expect((await validate(plainToInstance(ManualTeamAssignmentDto, { teamName: 123 }))).some(error => error.property === 'teamName')).toBe(true);
  });
  it('returns a clear 409 conflict without leaking SQL or treating other uniqueness errors as name conflicts', () => {
    const error = new QueryFailedError('INSERT private SQL', [], { code: '23505', constraint: 'team_names_cohort_key', message: 'database details' } as any);
    const json = jest.fn(), status = jest.fn(() => ({ json }));
    new GlobalExceptionFilter().catch(error, { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url: '/teams' }) }) } as any);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: TEAM_NAME_TAKEN }));
    expect(isTeamNameConflict(new QueryFailedError('', [], { code: '23505', constraint: 'invite_code' } as any))).toBe(false);
  });
});
