import { test, expect, type Page, type BrowserContext } from '@playwright/test';
const cohortId = 'deadlines-cohort';
const joinId = '534edc8d-e08c-4676-a370-63cdce161bd2', certificateId = 'db1532f6-f3d8-4933-920e-7e3d5d848c0c';
async function setup(page: Page, context: BrowserContext, role = 'program_manager') {
  const user = { id: 'deadline-manager', role, email: 'staff@example.test' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, cohortId }) => { localStorage.setItem('auth_token', 'test-token'); localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'staff', isAuthenticated: true }, version: 0 })); localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 })); }, { user, cohortId });
  const stages = [
    { id: joinId, number: 1, name: 'Joining milestone', deadline: '2031-09-13T18:15:00.000Z' },
    { id: certificateId, number: 2, name: 'Learning milestone', deadline: '2031-09-27T20:45:00.000Z' },
  ].map(stage => ({ ...stage, cohortId, type: 'mixed', requirements: {}, weightPercentage: 0, isActive: true, allowLateSubmissions: true, latePenaltyPercentage: 0, sortOrder: stage.number, unlocksMentorClaim: false, requiresManualApproval: false, requiresAiEvaluation: false, createdAt: '2031-09-01T00:00:00Z', updatedAt: '2031-09-01T00:00:00Z' }));
  const cohort = { id: cohortId, name: 'Stage-driven cohort', status: 'active', countries: ['Ghana'], groups: [], teamSizeMin: 3, teamSizeMax: 5, stageCount: 2, teamJoiningStageId: null as string | null, learningCertificationStageId: null as string | null, deadlines: {} };
  const writes: { path: string; body: any }[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method(); let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/cohorts/' + cohortId)) {
      if (method === 'PATCH') { const body = route.request().postDataJSON(); writes.push({ path, body }); Object.assign(cohort, body); }
      data = cohort;
    } else if (path.endsWith('/cohorts')) data = { data: [cohort], total: 1 };
    else if (path.endsWith('/stages') && method === 'POST') { const body = route.request().postDataJSON(); writes.push({ path, body }); data = { ...stages[0], ...body, id: 'created-stage' }; }
    else if (path.endsWith('/stages') || path.endsWith('/stats')) data = stages;
    else if (path.includes('/admin/stages/') && method === 'PATCH') {
      const body = route.request().postDataJSON(); writes.push({ path, body }); const stage = stages.find(stage => path.endsWith('/' + stage.id))!; Object.assign(stage, body); data = stage;
    } else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto(`/staff/cohorts/${cohortId}/stages`);
  await expect(page.getByRole('heading', { name: 'Team deadline stages', exact: true })).toBeVisible();
  return { stages, cohort, writes };
}

test('staff binds deadlines to stage IDs without sending calendar dates and sees later stage edits', async ({ page, context }) => {
  const state = await setup(page, context);
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(2);
  await page.getByLabel('Team joining deadline stage', { exact: true }).selectOption(joinId);
  await page.getByLabel('Learning certification deadline stage', { exact: true }).selectOption(certificateId);
  await expect(page.getByRole('definition').filter({ hasText: '2031-09-13 18:15 UTC' })).toBeVisible();
  await page.getByRole('button', { name: 'Save deadline stages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save deadline stages', exact: true })).toBeDisabled();
  expect(state.writes[0].body).toEqual({ teamJoiningStageId: joinId, learningCertificationStageId: certificateId });
  state.stages[0].deadline = '2031-09-14T06:30:00.000Z';
  await page.reload();
  await expect(page.getByRole('definition').filter({ hasText: '2031-09-14 06:30 UTC' })).toBeVisible();
});

test('prevents reversed cutoff order while allowing explicit removal of a mapping', async ({ page, context }) => {
  await setup(page, context);
  await page.getByLabel('Team joining deadline stage', { exact: true }).selectOption(certificateId);
  await page.getByLabel('Learning certification deadline stage', { exact: true }).selectOption(joinId);
  await expect(page.getByRole('alert').filter({ hasText: 'on or after' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save deadline stages', exact: true })).toBeDisabled();
  await page.getByLabel('Learning certification deadline stage', { exact: true }).selectOption('');
  await expect(page.getByRole('button', { name: 'Save deadline stages', exact: true })).toBeEnabled();
});

test('viewers can read the configuration but cannot change the selected stages', async ({ page, context }) => {
  await setup(page, context, 'viewer');
  await expect(page.getByLabel('Team joining deadline stage', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Learning certification deadline stage', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save deadline stages', exact: true })).toHaveCount(0);
});

test.describe('UTC stage editor', () => {
  test.use({ timezoneId: 'Africa/Nairobi' });
  test('submits UTC timestamps from a browser outside UTC', async ({ page, context }) => {
    const state = await setup(page, context);
    state.stages[0].deadline = '2031-09-13T23:45:00.000Z';
    await page.reload();
    await page.getByLabel('Team joining deadline stage', { exact: true }).selectOption(joinId);
    await expect(page.getByRole('definition').filter({ hasText: '2031-09-13 23:45 UTC' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Stage', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('UTC milestone');
    await dialog.getByLabel('Deadline (UTC)', { exact: true }).fill('2032-07-08T16:45');
    const request = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/admin/stages'));
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    expect((await request).postDataJSON().deadline).toBe('2032-07-08T16:45:00.000Z');
    expect(state.writes.at(-1)?.body.deadline).toBe('2032-07-08T16:45:00.000Z');
  });
});
