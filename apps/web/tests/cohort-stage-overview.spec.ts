import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const cohortId = 'cohort-stage-overview';
const names = ['Form a team', 'Choose a problem', 'Submit a proposal', 'Pass evaluation', 'Build and submit'];
const fixed = ['team', 'problem', 'proposal', 'evaluation', 'build'].map((key, index) => ({
  id: `fixed-${key}`, cohortId, number: index + 1, workflowKey: key, name: names[index], type: 'mixed',
  deadline: '2027-03-26T23:59:00Z', isActive: true, requirements: {}, stats: { submitted: 0, late: 0, evaluated: 0, draft: 0, total: 0 },
}));
const historical = ['Stage 1', 'Stage 2', 'Stage 3', 'Demo Day'].map((name, index) => ({
  id: `historical-${index}`, cohortId, number: index + 1, name, workflowKey: null, type: 'mixed',
  deadline: '2027-02-02T18:59:57Z', isActive: true, requirements: {}, stats: { submitted: 2, late: 0, evaluated: 0, draft: 0, total: 2 },
}));

async function setup(page: Page, context: BrowserContext, stages: unknown[]) {
  const user = { id: 'synthetic-staff', role: 'program_manager', email: 'staff@example.test', firstName: 'Synthetic', lastName: 'Staff', mustChangePassword: false };
  const cohort = { id: cohortId, name: 'Synthetic cohort', status: 'active', stageCount: fixed.length, groups: [], countries: ['GH'], teamSizeMin: 3, teamSizeMax: 5, briefCap: 50, maxTeamsPerBrief: 25, deadlines: {}, createdAt: '2026-11-01T00:00:00Z' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem('auth_token', 'synthetic');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'synthetic', portal: 'staff', isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  await page.routeWebSocket(/socket\.io/, socket => socket.close());
  await page.route('**/*onesignal*', route => route.abort());
  const writes: string[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() !== 'GET') writes.push(req.method() + ' ' + path);
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/cohorts')) data = { data: [cohort], total: 1 };
    else if (path.endsWith(`/cohorts/${cohortId}`)) data = { ...cohort, stageCount: stages.length };
    else if (path.endsWith(`/stages/cohort/${cohortId}/stats`) || path.endsWith('/stages')) data = stages;
    else if (path.endsWith('/statistics')) data = { participantCount: 0, teamCount: 0, briefCount: 0 };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  return writes;
}

test('cohort overview shows five programme stages in order while Manage retains historical submissions', async ({ page, context }) => {
  const stages = [historical[0], fixed[4], fixed[0], historical[3], fixed[2], historical[1], fixed[1], historical[2], fixed[3]];
  const writes = await setup(page, context, stages);
  await page.goto(`/staff/cohorts/${cohortId}`);
  const overview = page.getByRole('region', { name: 'Cohort stages', exact: true });
  await expect(overview.getByRole('heading', { name: 'Stages (5)', exact: true })).toBeVisible();
  await expect(overview.getByRole('heading', { level: 3 })).toHaveText(names);
  for (const old of historical) await expect(overview.getByText(old.name, { exact: true })).toHaveCount(0);
  await overview.getByRole('link', { name: 'Manage', exact: true }).click();
  await expect(page.getByRole('heading', { name: '5. Build and submit', exact: true })).toBeVisible();
  await page.getByText('Historical stages — submissions preserved', { exact: true }).click();
  await expect(page.getByText('Stage 1:', { exact: false })).toContainText('2 submissions');
  expect(writes).toEqual([]);
});

test('legacy-only cohort still shows its existing stages without inventing programme stages', async ({ page, context }) => {
  await setup(page, context, [...historical].reverse());
  await page.goto(`/staff/cohorts/${cohortId}`);
  const overview = page.getByRole('region', { name: 'Cohort stages', exact: true });
  await expect(overview.getByRole('heading', { name: 'Stages (4)', exact: true })).toBeVisible();
  await expect(overview.getByRole('heading', { level: 3 })).toHaveText(historical.map(stage => stage.name));
});

test('an empty cohort keeps the stage setup action', async ({ page, context }) => {
  await setup(page, context, []);
  await page.goto(`/staff/cohorts/${cohortId}`);
  const overview = page.getByRole('region', { name: 'Cohort stages', exact: true });
  await expect(overview.getByRole('heading', { name: 'Stages (0)', exact: true })).toBeVisible();
  await expect(overview.getByRole('link', { name: 'Add Stages', exact: true })).toHaveAttribute('href', `/staff/cohorts/${cohortId}/stages`);
});
