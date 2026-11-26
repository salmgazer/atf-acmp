import { DEFAULT_FORMATION_SETTINGS, builderRequirementForTeam, countsAsFormationBuilder, formationBuilderStatus, type TeamRuleParticipant } from '@acmp/shared';
import { formAtfTeams } from './atf-team-matcher';
const pending = (id: string): TeamRuleParticipant => ({ id, country: 'Ghana', cohortId: 'cohort', group: 'A', fieldOfStudy: 'Medicine', developmentExperience: true, testingExperience: true, deploymentExperience: true, builderConfirm: false, preference: { preferredRole: 'builder', firstChoiceSector: 'health', backupSector: 'education', crossCountryWilling: false } });
const person = (id: string) => ({ ...pending(id), developmentExperience: null, testingExperience: null, deploymentExperience: null, preference: { ...pending(id).preference, preferredRole: 'business_impact_lead' } });
describe('Flexible formation policy', () => {
  it('distinguishes confirmed, recorded and potential builders without counting explicit No answers', () => {
    const recorded = pending('recorded'), confirmed = { ...recorded, builderConfirm: true }, potential = { ...recorded, developmentExperience: null, testingExperience: null, deploymentExperience: null };
    expect(formationBuilderStatus(confirmed)).toBe('confirmed'); expect(formationBuilderStatus(recorded)).toBe('awaiting'); expect(formationBuilderStatus(potential)).toBe('potential');
    expect(countsAsFormationBuilder(recorded, 'confirmed')).toBe(false); expect(countsAsFormationBuilder(recorded, 'recorded')).toBe(true); expect(countsAsFormationBuilder(potential, 'recorded')).toBe(false); expect(countsAsFormationBuilder(potential, 'potential')).toBe(true);
    for (const field of ['developmentExperience', 'testingExperience', 'deploymentExperience']) expect(countsAsFormationBuilder({ ...potential, [field]: false }, 'potential')).toBe(false);
    expect(countsAsFormationBuilder({ ...potential, builderConfirm: true }, 'potential')).toBe(false);
    expect(countsAsFormationBuilder({ ...person('non-builder'), preferredLanguage: 'Python', languageProficiency: 'Expert' }, 'potential')).toBe(false);
  });
  it('uses confirmed builders before recorded builders and distributes builders before adding extras', () => {
    const pool = [{ ...pending('z-confirmed'), builderConfirm: true }, pending('a-recorded'), ...Array.from({ length: 6 }, (_, i) => person('other-'+i))];
    const teams = formAtfTeams(pool, 5, { ...DEFAULT_FORMATION_SETTINGS, shortageAction: 'leave_unassigned' }).teams;
    expect(teams).toHaveLength(2); expect(teams[0][0].id).toBe('z-confirmed'); expect(teams.every(team => team.filter(p => countsAsFormationBuilder(p)).length === 1)).toBe(true);
  });
  it.each([0, 1, 2])('honors a %s builder minimum and can form builder-free draft candidates', minimum => {
    const pool = [pending('b1'), pending('b2'), person('p')];
    const strict = { ...DEFAULT_FORMATION_SETTINGS, minimumBuilders: minimum, shortageAction: 'leave_unassigned' as const };
    expect(formAtfTeams(pool, 5, strict).teams).toHaveLength(1);
    expect(formAtfTeams([person('a'), person('b'), person('c')], 5, strict).teams).toHaveLength(minimum === 0 ? 1 : 0);
    expect(formAtfTeams([person('a'), person('b'), person('c')], 5, { ...strict, shortageAction: 'draft' }).teams).toHaveLength(1);
  });
  it('preserves country consent, groups, non-computing coverage and the selected minimum team size in permissive mode', () => {
    const policy = { ...DEFAULT_FORMATION_SETTINGS, minimumBuilders: 0 };
    expect(formAtfTeams([person('a'), { ...person('b'), country: 'Nigeria' }, person('c')], 5, policy).teams).toHaveLength(0);
    expect(formAtfTeams([person('a'), { ...person('b'), group: 'B' }, person('c')], 5, policy).teams).toHaveLength(0);
    expect(formAtfTeams(['a','b','c'].map(id => ({ ...person(id), fieldOfStudy: 'Computer Science' })), 5, policy).teams).toHaveLength(0);
    expect(formAtfTeams(['a','b','c'].map(person), 5, policy, 4).teams).toHaveLength(0);
  });
  it('does not let malformed or anonymous policies waive registration', () => {
    expect(builderRequirementForTeam({ version: 1, minimumBuilders: 0, builderEligibility: 'recorded', preferredBuilders: 2, exceptionGranted: true, reason: '', authorizedBy: 'staff' } as any).minimumBuilders).toBe(1);
    expect(builderRequirementForTeam({ version: 1, minimumBuilders: 0, builderEligibility: 'invalid', exceptionGranted: true } as any).minimumBuilders).toBe(1);
  });
});
