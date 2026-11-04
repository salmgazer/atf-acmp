import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const cohorts = ['cohort-one', 'cohort-two'].map((id, index) => ({ id, name: `Cohort ${index + 1}`, status: 'active', groups: [], countries: ['GH'], teamSizeMin: 3, teamSizeMax: 5, briefCap: 10, maxTeamsPerBrief: 3, deadlines: {}, createdAt: '2026-01-01T00:00:00Z' }));
const stage = { id: 'stage-one', name: 'Prototype', number: 1, cohortId: cohorts[0].id, requiresAiEvaluation: true, isActive: true };
const evaluation = { id: 'evaluation-one', team: { id: 'team-one', name: 'Test Team' }, stage, aiScores: [{ criterionId: 'quality', criterionName: 'Quality', score: 6, maxScore: 10, weight: 100 }], humanScores: [], aiOverallScore: 60, aiWeight: 0.5, finalScore: 60, isPublished: false, createdAt: '2026-01-01T00:00:00Z' };

async function staffSession(page: Page, context: BrowserContext, role: string, persistedRole = role) {
  const user = { id: 'test-staff', email: 'staff@example.test', firstName: 'Test', lastName: 'Staff', role };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, persistedRole }) => {
    localStorage.setItem('auth_token', 'test-access');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user: { ...user, role: persistedRole }, token: 'test-access', portal: 'staff', isAuthenticated: true }, version: 0 }));
  }, { user, persistedRole });
  const requests: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    requests.push(path);
    let data: unknown = {};
    if (path === '/auth/me') data = user;
    else if (path === '/cohorts') data = { data: cohorts, total: 2, totalPages: 1, meta: { total: 2, page: 1, limit: 100, totalPages: 1 } };
    else if (path === '/stages') data = [stage];
    else if (path === '/admin/evaluations') data = { data: [evaluation], total: 1 };
    else if (path === '/admin/evaluations/jobs') data = { data: [], total: 0 };
    else if (path === '/admin/evaluations/evaluation-one') data = evaluation;
    else if (path === '/participants') data = { data: [], total: 0, totalPages: 1 };
    else if (path === '/admin/staff') data = [{ ...user, role: 'evaluator', isActive: true, createdAt: '2026-01-01T00:00:00Z' }];
    else if (path === '/chat/channels/my') data = [];
    else if (path.startsWith('/notifications/')) data = { count: 0, data: [] };
    await route.fulfill({ json: data });
  });
  return requests;
}

for (const role of ['super_admin', 'program_manager', 'evaluator', 'viewer']) {
  test(`${role} sees the correct actions and retains access to both cohorts`, async ({ page, context }) => {
    await staffSession(page, context, role);
    await page.goto('/staff/participants');
    await expect(page.getByRole('heading', { name: 'Participants', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bulk Import', exact: true })).toHaveCount(['super_admin', 'program_manager'].includes(role) ? 2 : 0);
    await expect(page.getByRole('link', { name: 'Audit Logs', exact: true })).toHaveCount(['super_admin', 'program_manager'].includes(role) ? 1 : 0);
    await page.locator('aside').getByRole('combobox').click();
    await expect(page.getByRole('option', { name: 'Cohort 1' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cohort 2' })).toBeVisible();
    await page.getByRole('option', { name: 'Cohort 2' }).click();
    await expect(page.locator('aside').getByRole('combobox')).toContainText('Cohort 2');
  });
}

test('viewer cannot open import, audit or scoring pages directly and a stale admin role is replaced', async ({ page, context }) => {
  const requests = await staffSession(page, context, 'viewer', 'super_admin');
  for (const path of ['/staff/participants/import', '/staff/mentors/new', '/staff/mentors/any/edit', '/staff/audit-logs', '/staff/evaluations/evaluation-one/score']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
  }
  expect(requests).not.toContain('/admin/evaluations/evaluation-one');
  expect(requests).not.toContain('/admin/audit-logs');
  await page.goto('/staff/staff');
  await expect(page.getByRole('heading', { name: 'Staff Management' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Staff', exact: true })).toHaveCount(0);
  expect(requests).not.toContain('/admin/staff/statistics');
});

test('evaluator can open human scoring but cannot access program-management pages', async ({ page, context }) => {
  const requests = await staffSession(page, context, 'evaluator');
  await page.goto('/staff/evaluations/evaluation-one/score');
  await expect(page.getByRole('heading', { name: 'Test Team - Human Scoring' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Human Scores' })).toBeVisible();
  await page.getByPlaceholder('Your overall assessment and recommendations...').fill('A clear prototype with useful implementation details.');
  await page.getByRole('button', { name: 'Submit Human Scores' }).click();
  await expect.poll(() => requests.includes('/admin/evaluations/evaluation-one/human-score')).toBe(true);
  await page.goto('/staff/matching');
  await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
});

test('viewer reads evaluations without scoring, publishing or queue controls', async ({ page, context }) => {
  const requests = await staffSession(page, context, 'viewer');
  await page.goto('/staff/evaluations');
  await expect(page.getByRole('cell', { name: 'Test Team', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trigger Evaluation', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(requests).not.toContain('/admin/evaluations/queue/status');
  await page.getByRole('cell').last().getByRole('button').click();
  await expect(page.getByRole('menuitem', { name: 'View Details' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Human Score' })).toHaveCount(0);
});
