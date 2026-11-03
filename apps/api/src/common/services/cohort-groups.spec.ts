import { normalizeGroups, resolveCohortGroup } from './cohort-groups';

describe('Cohort group assignment', () => {
  it('normalizes names and resolves to the canonical cohort tag', () => {
    expect(normalizeGroups([' North ', 'South'])).toEqual(['North', 'South']);
    expect(resolveCohortGroup({ groups: ['North'] }, ' north ')).toBe('North');
  });
  it.each([['North', ' north '], [''], ['x'.repeat(101)], Array(101).fill('North')])('rejects invalid or duplicate group names: %j', (...groups) => {
    expect(() => normalizeGroups(groups as string[])).toThrow();
  });
  it.each([undefined, null, '', 'Other'])('requires a configured group for grouped cohorts: %s', group => {
    expect(() => resolveCohortGroup({ groups: ['North'] }, group)).toThrow();
  });
  it('preserves ungrouped cohorts and rejects foreign group tags', () => {
    expect(resolveCohortGroup({})).toBeNull();
    expect(() => resolveCohortGroup({}, 'North')).toThrow();
  });
});
