import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const id = '71b4a268-d167-49cb-9b94-760aacac3339', cohortId = 'profile-cohort';
const original = { id, participantId: 'ATF-PROFILE', firstName: 'Jane', lastName: 'Learner', email: 'login@example.test', lmsEmail: 'learning@example.test', country: 'Ghana', institution: 'Example university', phoneNumber: '+233200000000', whatsappNumber: '+233200000001', city: 'Accra', locationType: 'Urban', gender: 'Female', educationLevel: 'Diploma', fieldOfStudy: 'Law', pythonSkill: 'Intermediate', gitSkill: 'Basic', aiExperience: 'No experience', githubUsername: 'example-user', learningHalfwayReached: true, learningFinishedAllLessons: true, learningCertificateIssued: true, learningCertificateId: 'CERT-OLD', learningCertificateDate: '2026-10-25', status: 'ready', cohortId, group: 'Batch 1', mustChangePassword: false, onboardingComplete: true, skills: ['Python'], interests: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00.000Z' };
async function setup(page: Page, context: BrowserContext, options: { role?: string; failure?: 'conflict' | 'stale' } = {}) {
  const user = { id: 'staff', role: options.role || 'program_manager', email: 'staff@example.test', firstName: 'Example', lastName: 'Staff' };
  let current = { ...original };
  const writes: Record<string, unknown>[] = [], paths: string[] = [];
  const cohort = { id: cohortId, name: 'Profile cohort', status: 'active', countries: ['GH', 'NG', 'ZA'], groups: ['Batch 1'] };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'staff', isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; paths.push(path);
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith(`/participants/${id}/profile`) && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON(); writes.push(body);
      if (options.failure && writes.length === 1) {
        if (options.failure === 'stale') current = { ...current, city: 'Other staff city', updatedAt: '2026-11-12T21:00:00.000Z' };
        await route.fulfill({ status: 409, json: { message: options.failure === 'stale' ? 'Participant changed since this editor was opened. Reload the profile and review your edits.' : 'Learning certificate ID belongs to another participant' } }); return;
      }
      const { expectedUpdatedAt, allowLearningCorrections, ...changes } = body;
      current = { ...current, ...changes, updatedAt: '2026-11-12T22:00:00.000Z' };
      if (current.learningCertificateIssued !== true) { current.learningCertificateId = null as any; current.learningCertificateDate = null as any; }
      data = current;
    } else if (path.endsWith(`/participants/${id}`)) data = current;
    else if (path.endsWith('/cohorts')) data = { data: [cohort], total: 1 };
    else if (path.endsWith(`/cohorts/${cohortId}`)) data = cohort;
    else if (path.endsWith(`/teams/my/${id}`)) { await route.fulfill({ status: 200, body: '' }); return; }
    else if (path.endsWith('/preferences')) data = { briefRankings: [] };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto(`/staff/participants/${id}`);
  await expect(page.getByRole('heading', { name: 'Jane Learner', exact: true })).toBeVisible();
  return { writes, paths };
}
async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  return page.getByRole('dialog');
}

for (const role of ['program_manager', 'super_admin']) test(`${role} edits profile fields after reviewing only the changed values`, async ({ page, context }) => {
  const state = await setup(page, context, { role }), dialog = await openEditor(page);
  await expect(dialog.getByLabel('LMS email', { exact: true })).toHaveValue('learning@example.test');
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Accra');
  await expect(dialog.getByRole('button', { name: 'Review changes', exact: true })).toBeDisabled();
  await dialog.getByLabel('First name', { exact: true }).fill('Corrected');
  await dialog.getByLabel('City', { exact: true }).fill('Cape Town');
  await dialog.getByLabel('LMS email', { exact: true }).fill('corrected@example.test');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(dialog.getByRole('row').filter({ hasText: 'City' })).toContainText('Accra');
  await expect(dialog.getByRole('row').filter({ hasText: 'City' })).toContainText('Cape Town');
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Corrected Learner', exact: true })).toBeVisible();
  expect(state.writes).toEqual([{ firstName: 'Corrected', city: 'Cape Town', lmsEmail: 'corrected@example.test', expectedUpdatedAt: original.updatedAt, allowLearningCorrections: false }]);
  await expect(page.getByText(original.email, { exact: true })).toBeVisible();
  expect(state.paths.some(path => path.includes('resend') || path.includes('onboarding'))).toBe(false);
});

test('staff review certificate withdrawal with the associated ID and date being cleared', async ({ page, context }) => {
  const state = await setup(page, context), dialog = await openEditor(page);
  await dialog.getByLabel('Learning certificate issued', { exact: true }).selectOption('no');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(dialog.getByRole('row').filter({ hasText: 'Learning certificate ID' })).toContainText('CERT-OLD');
  await expect(dialog.getByRole('row').filter({ hasText: 'Learning certificate ID' })).toContainText('Not provided');
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0]).toMatchObject({ learningCertificateIssued: false, learningCertificateId: null, learningCertificateDate: null, allowLearningCorrections: true });
});

test('certificate ID is required for issued certificates before submitting a learning correction', async ({ page, context }) => {
  const state = await setup(page, context), dialog = await openEditor(page);
  await dialog.getByLabel('Learning certificate ID', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('requires a certificate ID');
  expect(state.writes).toHaveLength(0);
});

test('a failed save preserves edits and supports correction and retry', async ({ page, context }) => {
  const state = await setup(page, context, { failure: 'conflict' }), dialog = await openEditor(page);
  await dialog.getByLabel('Learning certificate ID', { exact: true }).fill('TAKEN-ID');
  await dialog.getByLabel('City', { exact: true }).fill('Updated city');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('belongs to another participant');
  await dialog.getByRole('button', { name: 'Back to editing', exact: true }).click();
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Updated city');
  await dialog.getByLabel('Learning certificate ID', { exact: true }).fill('CORRECT-ID');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog).not.toBeVisible(); expect(state.writes).toHaveLength(2);
});

test('stale edits can reload the latest record and save with its new version', async ({ page, context }) => {
  const state = await setup(page, context, { failure: 'stale' }), dialog = await openEditor(page);
  await dialog.getByLabel('City', { exact: true }).fill('Unsaved city');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Participant changed');
  await dialog.getByRole('button', { name: 'Reload latest profile', exact: true }).click();
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Other staff city');
  await dialog.getByLabel('City', { exact: true }).fill('Reviewed city');
  await dialog.getByRole('button', { name: 'Review changes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[1].expectedUpdatedAt).toBe('2026-11-12T21:00:00.000Z');
});

for (const role of ['viewer', 'evaluator']) test(`${role} can view the profile without editing it`, async ({ page, context }) => {
  await setup(page, context, { role });
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toHaveCount(0);
  await expect(page.getByText('learning@example.test', { exact: true })).toBeVisible();
});

test('cancelling a profile edit sends no changes', async ({ page, context }) => {
  const state = await setup(page, context), dialog = await openEditor(page);
  await dialog.getByLabel('City', { exact: true }).fill('Discarded city');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible(); expect(state.writes).toHaveLength(0);
});
