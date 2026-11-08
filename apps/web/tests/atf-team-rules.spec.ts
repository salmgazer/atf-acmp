import { test, expect, type Page, type BrowserContext } from '@playwright/test';
const cohortId = 'atf-cohort', participantId = 'atf-lead', teamId = 'atf-team';
const cohort = { id: cohortId, name: 'ATF cohort', status: 'active', groups: ['A'], countries: ['GH'], teamSizeMin: 3, teamSizeMax: 5, deadlines: {} };
const participant = { id: participantId, participantId: 'LMS-LEAD', email: 'lead@example.test', firstName: 'Example', lastName: 'Lead', cohortId, country: 'Ghana', group: 'A', status: 'assigned', onboardingComplete: true, mustChangePassword: false, skills: ['Python'], interests: [], createdAt: '2026-11-07T00:00:00Z', updatedAt: '2026-11-07T00:00:00Z', programmeOptedOut: false, codeLabsCompleted: false };
const baseReport = { canRegister: false, canStartChallenge: false, registrationIssues: [{ code: 'competition_country', message: 'Choose a competition country where at least one member lives' }], challengeIssues: [{ code: 'unregistered', message: 'Register the team before starting the challenge' }], guidance: ['Include at least one female member where possible', 'Include members from more than one institution where possible'], builderCount: 1, nonComputingCount: 2, sectorSpecialistCount: 1, impactLeadCount: 1, femaleCount: 0, institutionCount: 1, countries: ['Ghana'], competitionCountries: ['Ghana'], teamSize: 3, joinDeadline: '2026-11-13T23:59:59.999Z', certificateDeadline: '2026-11-27T23:59:59.999Z' };
async function setup(page: Page, context: BrowserContext, options: { staff?: boolean; member?: boolean; failRegister?: boolean; role?: string } = {}) {
  const portal = options.staff ? 'staff' : 'participant', user = { ...participant, role: options.role || (options.staff ? 'program_manager' : 'participant') };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: portal, url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, portal, cohortId }) => { localStorage.setItem('auth_token', 'test-token'); localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal, isAuthenticated: true }, version: 0 })); localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 })); }, { user, portal, cohortId });
  let certified = false, preview: any = null;
  const current = { ...participant };
  const team = { id: teamId, name: 'ATF practice team', cohortId, cohort, group: 'A', status: 'forming', inviteCode: 'ATF12345', createdAt: participant.createdAt, competitionCountry: null as string | null, registeredAt: null as string | null, challengeStartedAt: null as string | null, members: [participantId, 'specialist', 'impact'].map((id, index) => ({ id: 'member-' + index, participantId: id, teamId, role: index === 0 && !options.member ? 'lead' : 'member', status: 'confirmed', joinedAt: participant.createdAt, participant: { ...participant, id, firstName: index ? 'Teammate' : 'Example', lastName: String(index) } })) };
  const report = () => ({ ...baseReport, canRegister: !!team.competitionCountry, registrationIssues: team.competitionCountry ? [] : baseReport.registrationIssues, canStartChallenge: !!team.registeredAt && certified, challengeIssues: !team.registeredAt ? baseReport.challengeIssues : certified ? [] : [{ code: 'certificate', message: 'Complete all 40 lessons and hold the learning certificate before starting' }] });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/participants/me') || path.endsWith('/participants/' + participantId)) data = current;
    else if (path.endsWith('/participants/' + participantId + '/programme-status')) { Object.assign(current, route.request().postDataJSON(), { status: 'inactive' }); data = current; }
    else if (path.endsWith('/preferences')) data = { matchingProfileCompletedAt: participant.createdAt, preferredRole: 'builder', matchingProfileConsent: false };
    else if (path.endsWith('/cohorts')) data = { data: [cohort], total: 1 };
    else if (path.endsWith('/cohorts/' + cohortId)) data = cohort;
    else if (path.endsWith('/teams/my/' + participantId)) data = options.staff ? null : team;
    else if (path.endsWith('/teams/' + teamId)) data = team;
    else if (path.endsWith('/teams/' + teamId + '/eligibility')) data = report();
    else if (path.endsWith('/teams/' + teamId + '/register')) {
      if (options.failRegister) { await route.fulfill({ status: 409, json: { message: 'Team members changed. Review eligibility again.' } }); return; }
      team.competitionCountry = route.request().postDataJSON().competitionCountry; team.registeredAt = '2026-11-07T12:00:00Z'; data = team;
    } else if (path.endsWith('/teams/' + teamId + '/start-challenge')) { team.challengeStartedAt = '2026-11-07T13:00:00Z'; team.status = 'active'; data = team; }
    else if (path.endsWith('/formation/preview')) data = preview;
    else if (path.endsWith('/formation/run') && method === 'POST') { preview = { cohortId, cohortName: cohort.name, generatedAt: participant.createdAt, statistics: { totalEligibleParticipants: 3, proposedTeamCount: 1, averageTeamSize: 3, averageCompatibilityScore: 80, backfillStats: {} }, proposedTeams: [{ proposedTeamId: 'proposal', suggestedName: 'Team 1', competitionCountry: 'Ghana', group: 'A', participants: [{ id: participantId, firstName: 'Example', lastName: 'Lead' }], eligibility: baseReport }], proposedBackfills: [], proposedBriefAssignments: [], unassignedParticipantIds: [], warnings: [] }; data = preview; }
    else if (path.endsWith('/teams')) data = { data: [], total: 0, totalPages: 1 };
    else if (path.endsWith('/participants')) data = { data: [], total: 3, totalPages: 1 };
    else if (path.endsWith('/statistics') && path.includes('participants')) data = { total: 3, ready: 3, byCountry: { Ghana: 3 } };
    else if (path.endsWith('/statistics')) data = { total: 0, byStatus: {}, byCountry: {} };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  return { certify: () => { certified = true; }, team };
}

test('a lead selects a resident country and registers, then starts only after certificate checks pass', async ({ page, context }) => {
  const state = await setup(page, context); await page.goto('/participant/team');
  await expect(page.getByRole('button', { name: 'Register team', exact: true })).toBeDisabled();
  await page.getByLabel('Competition country').selectOption('Ghana');
  const register = page.waitForRequest(request => request.url().endsWith('/register') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Register team', exact: true }).click();
  expect((await register).postDataJSON()).toEqual({ competitionCountry: 'Ghana' });
  await expect(page.getByRole('button', { name: 'Start challenge', exact: true })).toBeDisabled();
  await expect(page.getByText('Complete all 40 lessons and hold the learning certificate before starting', { exact: false })).toBeVisible();
  state.certify(); await page.reload();
  await page.getByRole('button', { name: 'Start challenge', exact: true }).click();
  await expect(page.getByRole('main').getByText('Challenge started', { exact: true })).toBeVisible();
});

test('ordinary members see the checklist and mix guidance without registration controls', async ({ page, context }) => {
  await setup(page, context, { member: true }); await page.goto('/participant/team');
  await expect(page.getByRole('heading', { name: 'Team eligibility', exact: true })).toBeVisible();
  await expect(page.getByText('Include at least one female member where possible', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register team', exact: true })).toHaveCount(0);
});

test('stale registration errors retain the selected country and do not mark the team registered', async ({ page, context }) => {
  await setup(page, context, { failRegister: true }); await page.goto('/participant/team');
  await page.getByLabel('Competition country').selectOption('Ghana');
  await page.getByRole('button', { name: 'Register team', exact: true }).click();
  await expect(page.getByText('Team members changed. Review eligibility again.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Competition country')).toHaveValue('Ghana');
  await expect(page.getByText('Draft · registration required', { exact: true })).toBeVisible();
});

test('staff reviews the consequences before recording an opt-out', async ({ page, context }) => {
  await setup(page, context, { staff: true }); await page.goto('/staff/participants/' + participantId);
  await page.getByRole('checkbox', { name: 'Participant has opted out of the programme', exact: true }).check();
  await page.getByLabel('Opt-out reason or reference').fill('ATF opt-outs list');
  await page.getByRole('button', { name: 'Review programme update', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('removes this participant from teams');
  const update = page.waitForRequest(request => request.url().endsWith('/programme-status') && request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Confirm programme update', exact: true }).click();
  expect((await update).postDataJSON()).toMatchObject({ programmeOptedOut: true, codeLabsCompleted: false, reason: 'ATF opt-outs list' });
});

test('staff preview shows each proposed team and its builder/non-computing coverage before finalization', async ({ page, context }) => {
  await setup(page, context, { staff: true }); await page.goto('/staff/teams');
  await page.getByRole('button', { name: 'Run Team Formation', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Builders / non-computing', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Team 1', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '1 / 2', exact: true })).toBeVisible();
  await expect(page.getByText('Include members from more than one institution where possible', { exact: true })).toBeVisible();
});
