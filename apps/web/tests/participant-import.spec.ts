import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const cohortId = 'learning-cohort';
const csv = 'participant_id,lms_email,first_name,last_name,country,halfway_reached,certificate\nATF-123,learner@example.test,Example,Learner,Ghana,Yes,No\n';
const preview = { ready: true, previewHash: 'a'.repeat(64), sourceName: 'learners.csv', total: 1, counts: { new: 0, updated: 1, unchanged: 0, excluded: 0, conflict: 0 }, errors: [], warnings: [], records: [{ row: 2, participantId: 'ATF-123', email: 'learner@example.test', name: 'Example Learner', outcome: 'updated', warnings: ['Reviewed learning correction'], changes: [{ field: 'learningCertificateIssued', before: false, after: true }], data: { learningCertificateIssued: true } }] };
const batch = { id: 'learning-batch', state: 'completed', sourceName: 'learners.csv', result: { stage: 'completed', counts: preview.counts, invitationState: 'not_requested', affectedTeamIds: [] } };
async function setup(page: Page, context: BrowserContext, role = 'program_manager') {
  const user = { id: 'learning-staff', email: 'staff@example.test', role };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => {
    localStorage.setItem('auth_token', 'test-access');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-access', portal: 'staff', isAuthenticated: true }, version: 0 }));
  }, user);
  const requests: { path: string; body: any }[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    let data: unknown = [];
    if (path === '/auth/me') data = user;
    else if (path === '/cohorts') data = { data: [{ id: cohortId, name: 'Learning cohort', status: 'active', groups: ['Batch 1'] }] };
    else if (path.endsWith('/import/preview')) { requests.push({ path, body: route.request().postDataJSON() }); data = preview; }
    else if (path.endsWith('/import/apply')) { requests.push({ path, body: route.request().postDataJSON() }); data = batch; }
    else if (path.endsWith('/import/batches/learning-batch')) data = batch;
    await route.fulfill({ json: data });
  });
  await page.goto('/staff/participants/import');
  return requests;
}
async function prepare(page: Page) {
  await page.getByLabel('Cohort', { exact: true }).selectOption(cohortId);
  await page.getByLabel('Participant CSV file').setInputFiles({ name: 'learners.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review and import', exact: true })).toBeEnabled();
}

test('reviews learning-only changes, confirms once, downloads a receipt and restores progress on reload', async ({ page, context }) => {
  const requests = await setup(page, context);
  await prepare(page);
  expect(requests[0].body.updateFields).toEqual(['learningCertificateIssued', 'learningCertificateId', 'learningCertificateDate', 'learningFinishedAllLessons', 'learningHalfwayReached']);
  await page.getByRole('button', { name: 'Review row 2' }).click();
  await expect(page.getByRole('dialog')).toContainText('Reviewed learning correction');
  await expect(page.getByRole('dialog').getByRole('cell', { name: 'No', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('cell', { name: 'Yes', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const apply = page.getByRole('button', { name: 'Review and import', exact: true });
  await apply.click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(requests.filter(request => request.path.endsWith('apply'))).toHaveLength(0);
  await apply.click(); await page.getByRole('button', { name: 'Queue import', exact: true }).click();
  await expect(page.getByText('Participant import complete', { exact: true })).toBeVisible();
  expect(requests.filter(request => request.path.endsWith('apply'))).toHaveLength(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download import receipt' }).click();
  expect((await download).suggestedFilename()).toBe('participant-import-learning-batch.json');
  await page.reload();
  await expect(page.getByText('Participant import complete', { exact: true })).toBeVisible();
});

test('optional profile selection invalidates preview and update-only excludes the group', async ({ page, context }) => {
  const requests = await setup(page, context); await prepare(page);
  await page.getByText('Optional profile updates', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'City', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Review and import', exact: true })).toBeDisabled();
  await page.getByLabel('Import mode').selectOption('update_only');
  await expect(page.getByLabel('Group for new participants')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  expect(requests.at(-1)!.body).toMatchObject({ mode: 'update_only', updateFields: expect.arrayContaining(['city']) });
  expect(requests.at(-1)!.body.group).toBeUndefined();
});

test('stale application retains CSV and requires a fresh preview', async ({ page, context }) => {
  await setup(page, context); await prepare(page);
  await page.route('**/participants/import/apply', route => route.fulfill({ status: 409, json: { message: 'Participant records changed. Refresh the preview.' } }));
  await page.getByRole('button', { name: 'Review and import', exact: true }).click();
  await page.getByRole('button', { name: 'Queue import', exact: true }).click();
  await expect(page.getByText('Participant records changed. Refresh the preview.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review and import', exact: true })).toBeDisabled();
  await page.getByText('Or paste CSV', { exact: true }).click();
  await expect(page.getByLabel('Participant CSV', { exact: true })).toHaveValue(csv);
});

test('conflicting rows block application', async ({ page, context }) => {
  await setup(page, context);
  await page.route('**/participants/import/preview', route => route.fulfill({ json: { ...preview, ready: false, counts: { ...preview.counts, updated: 0, conflict: 1 }, records: [{ ...preview.records[0], outcome: 'conflict', reason: 'Participant ID and LMS email do not match' }] } }));
  await page.getByLabel('Cohort', { exact: true }).selectOption(cohortId);
  await page.getByLabel('Participant CSV file').setInputFiles({ name: 'learners.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.getByText('Participant ID and LMS email do not match')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review and import', exact: true })).toBeDisabled();
});

for (const role of ['viewer', 'evaluator']) test(`${role} cannot access participant imports`, async ({ page, context }) => {
  const requests = await setup(page, context, role);
  await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview import', exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
