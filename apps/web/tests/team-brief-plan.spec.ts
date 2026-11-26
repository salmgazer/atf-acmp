import { DEFAULT_FORMATION_SETTINGS } from '@acmp/shared';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
const id = 'brief-plan-lead', cohortId = 'brief-plan-cohort', teamId = 'brief-plan-team', date = '2026-11-18T08:00:00Z';
async function setup(page: Page, context: BrowserContext, options: { staff?: boolean; role?: string; assigned?: boolean; failSave?: boolean; ready?: number; combined?: boolean } = {}) {
  const portal = options.staff ? 'staff' : 'participant', user = { id, role: options.staff ? 'program_manager' : 'participant', email: 'synthetic@example.test', firstName: 'Example', lastName: 'Lead', participantId: 'SYNTHETIC-LEAD', cohortId, country: 'Ghana', status: 'assigned', onboardingComplete: true, mustChangePassword: false, skills: [], interests: [] };
  const cohort = { id: cohortId, name: 'Brief plan cohort', countries: ['GH'], status: 'active', teamSizeMin: 3, teamSizeMax: 5 };
  const team = { id: teamId, name: 'Brief plan team', cohortId, cohort, briefPreference: 'partner', briefId: options.assigned ? 'assigned-brief' : null, brief: options.assigned ? { id: 'assigned-brief', title: 'Existing brief' } : null, status: 'forming', inviteCode: 'PLAN1234', createdAt: date, members: [id, 'specialist', 'impact'].map((pid, i) => ({ id: 'membership-' + i, teamId, participantId: pid, role: i ? 'member' : options.role || 'lead', status: 'confirmed', joinedAt: date, participant: { ...user, id: pid, firstName: i ? 'Teammate' : 'Example', lastName: String(i) } })) };
  let formation: any = options.combined ? { cohortId, generatedAt: date, configUsed: { useBriefCentricAssignment: true }, statistics: { proposedTeamCount: 1, totalEligibleParticipants: 3, averageTeamSize: 3, averageCompatibilityScore: 80, backfillStats: {} }, proposedTeams: [{ proposedTeamId: 'combined-team', suggestedName: 'Combined preview team', participants: [] }], warnings: [] } : null, matching: any = null, assigned = false;
  const writes: { path: string; method: string; body: any }[] = [];
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: portal, url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, portal, cohortId }) => { localStorage.setItem('auth_token', 'synthetic'); localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'synthetic', portal, isAuthenticated: true }, version: 0 })); localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 })); }, { user, portal, cohortId });
  await page.routeWebSocket(/socket\.io/, socket => socket.close()); await page.route('**/*onesignal*', route => route.abort());
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method(); let data: unknown = [];
    if (!['GET', 'HEAD'].includes(method)) writes.push({ path, method, body: req.postDataJSON() });
    if (path.endsWith('/brief-preference') && method === 'PATCH') {
      if (options.failSave && writes.length === 1) { await route.fulfill({ status: 503, json: { message: 'Could not save. Please retry.' } }); return; }
      team.briefPreference = req.postDataJSON().briefPreference; data = team;
    } else if (path.endsWith('/auth/me') || path.endsWith('/participants/me')) data = user;
    else if (path.endsWith('/teams/my/' + id) || path.endsWith('/teams/' + teamId)) data = team;
    else if (path.endsWith('/cohorts')) data = { data: [cohort], total: 1 };
    else if (path.endsWith('/cohorts/' + cohortId)) data = cohort;
    else if (path.endsWith('/formation/defaults')) data = { settings: DEFAULT_FORMATION_SETTINGS, updatedAt: '2026-11-01T00:00:00Z' };
    else if (path.endsWith('/formation/preview')) { if (method === 'DELETE') formation = null; data = formation; }
    else if (path.endsWith('/formation/run')) data = formation = { cohortId, generatedAt: date, configUsed: { useBriefCentricAssignment: false }, statistics: { proposedTeamCount: 1, totalEligibleParticipants: 3, averageTeamSize: 3, averageCompatibilityScore: 80, backfillStats: {} }, proposedTeams: [{ proposedTeamId: 'new-team', suggestedName: 'New formed team', participants: [], eligibility: { guidance: [], builderCount: 1, nonComputingCount: 1 } }], warnings: [] };
    else if (path.endsWith('/formation/finalize')) { formation = null; data = { createdTeamCount: 1, backfilledTeamCount: 0, briefsAssigned: 0, errors: [] }; }
    else if (path.endsWith('/matching/team-status')) data = [{ teamId, teamName: team.name, memberCount: 3, currentBriefId: assigned ? 'partner-brief' : null, hasPreferences: true, briefPreference: 'partner' }, { teamId: 'own-team', teamName: 'Own brief team', memberCount: 3, currentBriefId: null, hasPreferences: true, briefPreference: 'own' }, { teamId: 'already-assigned', memberCount: 3, currentBriefId: 'existing', briefPreference: 'partner' }];
    else if (path.endsWith('/matching/brief-capacities')) data = [{ briefId: 'partner-brief', briefTitle: 'Partner brief', organizationName: 'Partner', verticalName: 'Health', maxTeams: 5, currentTeams: 0, previewTeams: 0, availableSlots: 5 }];
    else if (path.endsWith('/matching/preview')) data = matching;
    else if (path.endsWith('/matching/run')) data = matching = { cohortId, generatedAt: date, statistics: { totalTeams: 1, matchedTeams: 1, unmatchedTeams: 0, totalBriefs: 1, averageScore: 80, firstChoicePercentage: 100, topThreePercentage: 100, matchedToRankedBrief: 1 }, matches: [{ teamId, teamName: team.name, briefId: 'partner-brief', briefTitle: 'Partner brief', organizationName: 'Partner', score: 80, rankPosition: 1, scoreBreakdown: { rankingScore: 80, verticalScore: 0, skillScore: 0 }, skillOverlap: 0 }], unmatchedTeamIds: [], warnings: [] };
    else if (path.endsWith('/matching/finalize')) { matching = null; assigned = true; data = { assignedCount: 1, errors: [] }; }
    else if (path.endsWith('/teams')) data = { data: [team], total: 1, totalPages: 1 };
    else if (path.endsWith('/participants')) data = { data: [], total: 3, totalPages: 1 };
    else if (path.includes('participants') && path.endsWith('/statistics')) data = { total: 3, ready: options.ready ?? 3, byCountry: {} };
    else if (path.endsWith('/statistics')) data = { total: 3, withBrief: 1, withoutBrief: 2, byStatus: {}, byCountry: {} };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  return { writes, team };
}

test('formation explicitly excludes assignment and provides an independent assignment action even with no unassigned participants', async ({ page, context }) => {
  const state = await setup(page, context, { staff: true }); await page.goto('/staff/teams');
  await expect(page.getByRole('link', { name: 'Assign briefs', exact: true })).toHaveAttribute('href', `/staff/matching?cohortId=${cohortId}`);
  await page.getByRole('button', { name: 'Team formation', exact: true }).click();
  await page.getByRole('button', { name: 'Run Team Formation', exact: true }).click();
  expect(state.writes[0]).toMatchObject({ path: `/api/admin/cohorts/${cohortId}/matching/formation/run`, body: { config: { useBriefCentricAssignment: false } } });
  await page.getByRole('button', { name: 'Finalize (1 teams)', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Finalize Team Formation', exact: true });
  await expect(confirmation).toContainText('without assigning briefs');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clear Preview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finalize (1 teams)', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Create Teams', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Teams', exact: true })).toBeVisible();
  expect(state.writes.every(w => w.path.includes('/formation/'))).toBe(true);
});

test('brief assignment is available after formation even when no participants need a team, and never calls formation endpoints', async ({ page, context }) => {
  const state = await setup(page, context, { staff: true, ready: 0 }); await page.goto('/staff/teams');
  await expect(page.getByRole('button', { name: 'Run Team Formation', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Assign briefs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partner Brief Assignment', exact: true })).toBeVisible();
  await expect(page.getByText('Teams creating their own briefs are skipped.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Run Matching', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Brief plan team', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Own brief team', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Finalize Assignments', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm & Assign', exact: true }).click();
  expect(state.writes.map(w => w.path)).toEqual([`/api/admin/cohorts/${cohortId}/matching/run`, `/api/admin/cohorts/${cohortId}/matching/finalize`]);
});

test('the lead can opt out and back into partner assignment without creating a custom brief or changing membership', async ({ page, context }) => {
  const state = await setup(page, context); await page.goto('/participant/team');
  const select = page.getByLabel('How will your team get its brief?', { exact: true });
  await select.selectOption('own'); await expect(page.getByText('Save your preference, then submit your problem brief for ATF review', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save brief preference', exact: true }).click();
  await page.reload(); await expect(select).toHaveValue('own');
  await select.selectOption('partner'); await page.getByRole('button', { name: 'Save brief preference', exact: true }).click();
  expect(state.writes.map(w => w.body)).toEqual([{ briefPreference: 'own' }, { briefPreference: 'partner' }]);
  expect(state.team.members).toHaveLength(3); expect(state.team.briefId).toBeNull();
});
for (const role of ['co_lead', 'member']) test(`${role} can see the team's choice but cannot change it`, async ({ page, context }) => {
  await setup(page, context, { role }); await page.goto('/participant/team');
  await expect(page.getByText('Only the team lead can change this preference.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('How will your team get its brief?', { exact: true })).toHaveCount(0);
});
test('an assigned brief prevents switching to an own brief and a failed save retains the selected preference for retry', async ({ page, context }) => {
  const state = await setup(page, context, { failSave: true }); await page.goto('/participant/team');
  await page.getByLabel('How will your team get its brief?', { exact: true }).selectOption('own');
  await page.getByRole('button', { name: 'Save brief preference', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please retry' })).toBeVisible();
  await expect(page.getByLabel('How will your team get its brief?', { exact: true })).toHaveValue('own');
  await page.getByRole('button', { name: 'Save brief preference', exact: true }).click();
  expect(state.writes).toHaveLength(2);
  state.team.briefId = 'assigned-brief'; state.team.brief = { id: 'assigned-brief', title: 'Existing brief' }; await page.reload();
  await expect(page.getByText('Contact staff to unassign the current brief', { exact: false })).toBeVisible();
  await expect(page.getByLabel('How will your team get its brief?', { exact: true })).toHaveCount(0);
});

test('a combined preview from another client cannot silently assign briefs through the formation-only confirmation', async ({ page, context }) => {
  const state = await setup(page, context, { staff: true, combined: true }); await page.goto('/staff/teams');
  await page.getByRole('button', { name: 'Team formation', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This preview includes brief assignments.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalize (1 teams)', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Run Team Formation', exact: true }).click();
  expect(state.writes.at(-1)?.body).toEqual({ config: { ...DEFAULT_FORMATION_SETTINGS, useBriefCentricAssignment: false } });
});

for (const viewport of [{ width: 1366, height: 900, theme: "light" }, { width: 390, height: 844, theme: "light" }, { width: 1366, height: 900, theme: "dark" }]) test(`teams table stays prominent and formation opens without changes at ${viewport.width}px in ${viewport.theme} mode`, async ({ page, context }) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(theme => localStorage.setItem("theme", theme), viewport.theme);
  const state = await setup(page, context, { staff: true });
  await page.goto('/staff/teams');
  await expect(page.locator("html")).toHaveClass(new RegExp(viewport.theme));
  const table = page.getByRole('table', { name: 'Teams', exact: true });
  await expect(table.getByRole('cell', { name: 'Brief plan team', exact: false })).toBeVisible();
  const tableBox = await table.boundingBox();
  expect(tableBox!.y).toBeLessThan(viewport.width > 1000 ? 400 : 660);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/acmp-teams-layout-${viewport.width}-${viewport.theme}.png` });
  const region = page.getByRole('region', { name: 'Teams table', exact: true });
  if (viewport.width < 1000) expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Team formation', exact: true }).click();
  const workspace = page.getByRole('dialog');
  await expect(workspace.getByRole('button', { name: 'Run Team Formation', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Run Team Formation', exact: true }).click();
  await expect(workspace.getByRole('cell', { name: /^New formed team/ })).toBeVisible();
  const workspaceBox = await workspace.boundingBox();
  expect(workspaceBox!.x).toBeGreaterThanOrEqual(0);
  expect(workspaceBox!.x + workspaceBox!.width).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: `/tmp/acmp-teams-formation-${viewport.width}-${viewport.theme}.png` });
  await workspace.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(workspace).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Team formation", exact: true })).toBeFocused();
  await expect(table).toBeVisible();
  await expect(page.getByRole('button', { name: 'Team formation', exact: true })).toContainText('Preview ready');
  await page.getByRole('button', { name: 'Team formation', exact: true }).click();
  await expect(page.getByRole('cell', { name: /^New formed team/ })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
