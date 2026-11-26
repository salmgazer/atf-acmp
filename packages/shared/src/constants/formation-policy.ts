import type { BuilderProfile } from './builder-profile';

export type BuilderEligibility = 'confirmed' | 'recorded' | 'potential';
export type BuilderStatus = 'confirmed' | 'awaiting' | 'potential' | 'non_builder';
export type BuilderShortageAction = 'leave_unassigned' | 'draft' | 'exception';
export interface BuilderRequirement { builderEligibility: BuilderEligibility; minimumBuilders: number; preferredBuilders: number }
export interface FormationSettings extends BuilderRequirement {
  shortageAction: BuilderShortageAction;
  matchingScope: 'new' | 'backfill' | 'both';
  exceptionReason: string;
}
export interface TeamBuilderPolicy extends BuilderRequirement {
  version: 1; exceptionGranted: boolean; reason: string; authorizedBy: string; authorizedAt: string;
}
export const DEFAULT_FORMATION_SETTINGS: FormationSettings = {
  builderEligibility: 'recorded', minimumBuilders: 1, preferredBuilders: 2,
  shortageAction: 'draft', matchingScope: 'both', exceptionReason: '',
};
export const BUILDER_STATUS_LABELS: Record<BuilderStatus, string> = {
  confirmed: 'Confirmed builder', awaiting: 'Awaiting confirmation', potential: 'Potential builder', non_builder: 'Not a builder',
};
export function formationBuilderStatus(person: BuilderProfile & { preference?: { preferredRole?: string | null } | null }): BuilderStatus {
  const answers = [person.developmentExperience, person.testingExperience, person.deploymentExperience];
  if (answers.every(answer => answer === true)) return person.builderConfirm === true ? 'confirmed' : 'awaiting';
  if (person.builderConfirm !== true && person.preference?.preferredRole === 'builder' && !answers.includes(false) && answers.some(answer => answer == null)) return 'potential';
  return 'non_builder';
}
export function countsAsFormationBuilder(person: Parameters<typeof formationBuilderStatus>[0], eligibility: BuilderEligibility = 'recorded'): boolean {
  const status = formationBuilderStatus(person);
  return status === 'confirmed' || status === 'awaiting' && eligibility !== 'confirmed' || status === 'potential' && eligibility === 'potential';
}
export function builderCoverage(members: Parameters<typeof formationBuilderStatus>[0][], requirement: BuilderRequirement = DEFAULT_FORMATION_SETTINGS) {
  const statuses = members.map(formationBuilderStatus);
  return { confirmed: statuses.filter(status => status === 'confirmed').length,
    awaiting: statuses.filter(status => status === 'awaiting').length, potential: statuses.filter(status => status === 'potential').length,
    counted: members.filter(person => countsAsFormationBuilder(person, requirement.builderEligibility)).length, required: requirement.minimumBuilders };
}
/** Only server-created team policies may waive a registration requirement. */
export function builderRequirementForTeam(policy?: TeamBuilderPolicy | null): BuilderRequirement {
  if (!policy || policy.version !== 1 || !['confirmed', 'recorded', 'potential'].includes(policy.builderEligibility) || ![0, 1, 2].includes(policy.minimumBuilders) || ![0, 1, 2].includes(policy.preferredBuilders) || !policy.authorizedBy) return DEFAULT_FORMATION_SETTINGS;
  const waiver = policy.exceptionGranted === true && typeof policy.reason === 'string' && policy.reason.trim().length >= 10;
  // A zero minimum is itself a waiver and must carry a staff reason.
  return { builderEligibility: policy.builderEligibility, minimumBuilders: waiver ? 0 : Math.max(1, policy.minimumBuilders), preferredBuilders: policy.preferredBuilders };
}
