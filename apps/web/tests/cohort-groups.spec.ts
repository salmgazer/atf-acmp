import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const cohort = { id: 'group-cohort', name: 'Grouped cohort', status: 'active', groups: ['North', 'South'], countries: ['GH'], verticals: [], teamSizeMin: 3, teamSizeMax: 5, briefCap: 50, maxTeamsPerBrief: 25, deadlines: {}, createdAt: '2026-11-01T00:00:00Z' };
const participant = { id: 'group-participant', participantId: 'ATF-001', email: 'person@example.test', firstName: 'Group', lastName: 'Participant', country: 'GH', cohortId: cohort.id, group: 'North', status: 'ready', skills: [], interests: [], onboardingComplete: true, createdAt: '2026-11-01T00:00:00Z' };

async function setup(context: BrowserContext, page: Page, portal: 'staff' | 'participant' = 'staff') {
  const user = { ...participant, role: portal === 'staff' ? 'program_manager' : 'participant' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: portal, url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, portal, cohortId }) => {
    localStorage.setItem('auth_token', 'test-access');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-access', portal, isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, portal, cohortId: cohort.id });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), pathname = url.pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/me')) data = user;
    else if (pathname.endsWith('/participants/me')) data = participant;
    else if (pathname.endsWith('/cohorts')) data = { data: [cohort], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } };
    else if (pathname.endsWith('/cohorts/group-cohort')) data = cohort;
    else if (pathname.endsWith('/statistics')) data = { total: 1, byCountry: { GH: 1 } };
    else if (pathname.endsWith('/participants')) data = { data: url.searchParams.get('group') === 'South' ? [] : [participant], total: 1, totalPages: 1 };
    else if (pathname.endsWith('/teams')) data = { data: [], total: 0, totalPages: 1 };
    else if (pathname.includes('team-formation') || pathname.includes('/matching/')) data = null;
    else if (pathname.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
}

test('staff can add and remove group tags in cohort settings', async ({ context, page }) => {
  await setup(context, page);
  await page.goto('/staff/cohorts/group-cohort/edit');
  await page.getByLabel('New group name').fill('East');
  await page.getByRole('button', { name: 'Add group', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove group East' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove group South' }).click();
  const saved = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/cohorts/group-cohort'));
  await page.getByRole('button', { name: 'Update Cohort' }).click();
  expect((await saved).postDataJSON().groups).toEqual(['North', 'East']);
});

test('grouped participant imports require a selection and include it in the request', async ({ context, page }) => {
  await setup(context, page);
  await page.route('**/participants/import/preview', route => {
    const valid = route.request().postDataJSON().group === 'South';
    return route.fulfill({ json: { ready: valid, previewHash: 'a'.repeat(64), total: 1, counts: { new: valid ? 1 : 0, updated: 0, unchanged: 0, excluded: 0, conflict: valid ? 0 : 1 }, errors: [], warnings: [], records: [{ row: 2, participantId: 'ATF-002', name: 'Import Test', outcome: valid ? 'new' : 'conflict', reason: valid ? undefined : 'Select a cohort group for new participants', changes: [], warnings: [], data: {} }] } });
  });
  await page.route('**/participants/import/apply', route => route.fulfill({ json: { id: 'group-import-batch', state: 'completed', sourceName: 'participants.csv', result: { counts: { new: 1 }, stage: 'completed' } } }));
  await page.route('**/participants/import/batches/group-import-batch', route => route.fulfill({ json: { id: 'group-import-batch', state: 'completed', sourceName: 'participants.csv', result: { counts: { new: 1 }, stage: 'completed' } } }));
  await page.goto('/staff/participants/import');
  await page.getByLabel('Cohort', { exact: true }).selectOption(cohort.id);
  await page.getByLabel('Participant CSV file').setInputFiles({ name: 'participants.csv', mimeType: 'text/csv', buffer: Buffer.from('participant_id,lms_email,first_name,last_name,country,halfway_reached\nATF-002,import@example.test,Import,Test,GH,Yes\n') });
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  const submit = page.getByRole('button', { name: 'Review and import', exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Group for new participants').selectOption('South');
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(submit).toBeEnabled();
  const sent = page.waitForRequest(request => request.url().endsWith('/participants/import/apply') && request.method() === 'POST');
  await submit.click();
  await page.getByRole('button', { name: 'Queue import', exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({ cohortId: cohort.id, group: 'South' });
});

for (const resource of ['participants', 'teams']) test(`staff ${resource} filters send the selected group`, async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`/staff/${resource}`);
  await page.getByRole('button', { name: /Filters/ }).click();
  const filtered = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/${resource}`) && url.searchParams.get('group') === 'South';
  });
  await page.getByLabel('Filter by group').selectOption('group:South');
  await filtered;
  await expect(page.getByLabel('Filter by group')).toHaveValue('group:South');
});

test('participant profile displays the assigned group', async ({ context, page }) => {
  await setup(context, page, 'participant');
  await page.goto('/participant/profile');
  await expect(page.getByText('North', { exact: true })).toBeVisible();
});

test('staff manual team creation shows the lead group and sends the lead identity', async ({ context, page }) => {
  await setup(context, page);
  await page.route('**/teams/search/participants?**', route => route.fulfill({ json: [participant] }));
  await page.route('**/api/teams', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ json: { id: 'created-team' } });
    else await route.fallback();
  });
  await page.goto('/staff/teams');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team name').fill('Manual team');
  await dialog.getByLabel('Find a team lead').fill('Group');
  await dialog.getByLabel('Team lead', { exact: true }).selectOption(participant.id);
  await expect(dialog.getByText('Group: North', { exact: true })).toBeVisible();
  const created = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/teams'));
  await dialog.getByRole('button', { name: 'Create team', exact: true }).click();
  expect((await created).postDataJSON()).toEqual({ name: 'Manual team', cohortId: cohort.id, creatorId: participant.id });
});
