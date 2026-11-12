import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const cohortId = 'country-cohort';
const briefs = [
  { id: 'explicit', title: 'Kenya problem', problemCountry: 'Kenya', organization: { name: 'Ghana partner', country: 'Ghana' }, status: 'submitted' },
  { id: 'fallback', title: 'Legacy Kenya problem', problemCountry: null, organization: { name: 'Kenya partner', country: 'KE' }, status: 'in_review' },
  { id: 'ghana', title: 'Ghana problem', problemCountry: 'GH', organization: { name: 'Kenya partner', country: 'Kenya' }, status: 'approved' },
  { id: 'unknown', title: 'Country not provided', organization: { name: 'Unknown partner' }, status: 'submitted' },
].map(b => ({ ...b, cohortId, description: 'A challenge brief for review', maxTeams: 5, teamsCount: 0, createdAt: '2026-11-01T12:00:00Z', submittedAt: '2026-11-02T12:00:00Z' }));
async function setup(page: Page, context: BrowserContext) {
  const user = { id: 'staff', role: 'program_manager', email: 'staff@example.test', firstName: 'Test', lastName: 'Staff' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'staff', isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  const requests: URL[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    requests.push(url);
    const country = url.searchParams.get('country');
    const selected = briefs.filter(b => !country || (b.problemCountry || b.organization.country || '').replace(/^KE$/, 'Kenya').replace(/^GH$/, 'Ghana') === country);
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/cohorts')) data = { data: [{ id: cohortId, name: 'Country cohort', status: 'active', countries: ['GH', 'KE', 'NG', 'ZA'] }], total: 1 };
    else if (path.endsWith('/briefs/statistics')) data = { total: selected.length, submitted: selected.filter(b => b.status === 'submitted').length, inReview: selected.filter(b => b.status === 'in_review').length, approved: selected.filter(b => b.status === 'approved').length };
    else if (path.endsWith('/briefs')) {
      const rows = selected.filter(b => !url.searchParams.has('pendingReview') || ['submitted', 'in_review'].includes(b.status));
      const exporting = url.searchParams.get('limit') === '500';
      const page = Number(url.searchParams.get('page') || '1');
      data = { data: exporting ? rows.slice(page - 1, page) : rows, total: rows.length, totalPages: exporting ? rows.length : 1 };
    } else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/staff/briefs');
  await expect(page.getByRole('columnheader', { name: 'Country', exact: true })).toBeVisible();
  return requests;
}
async function selectKenya(page: Page) {
  await page.getByRole('combobox', { name: 'Filter briefs by country' }).click();
  await page.getByRole('option', { name: 'Kenya', exact: true }).click();
}

test('shows brief country with partner-country fallback and a dash when neither exists', async ({ page, context }) => {
  await setup(page, context);
  await expect(page.getByRole('row').filter({ hasText: 'Kenya problem' }).first().getByRole('cell').nth(2)).toHaveText('Kenya');
  await expect(page.getByRole('row').filter({ hasText: 'Legacy Kenya problem' }).getByRole('cell').nth(2)).toHaveText('Kenya');
  await expect(page.getByRole('row').filter({ hasText: 'Ghana problem' }).getByRole('cell', { name: 'Ghana', exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Country not provided' }).getByRole('cell').nth(2)).toHaveText('—');
});

test('country filters list and summary counts, combines with Pending Review and clears cleanly', async ({ page, context }) => {
  const requests = await setup(page, context);
  await selectKenya(page);
  await expect(page.getByRole('link', { name: 'Ghana problem', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Legacy Kenya problem', exact: true })).toBeVisible();
  await expect.poll(() => requests.some(url => url.pathname.endsWith('/briefs/statistics') && url.searchParams.get('country') === 'Kenya')).toBe(true);
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('button', { name: /^Pending Review/ }).click();
  await expect.poll(() => requests.some(url => url.pathname.endsWith('/briefs') && url.searchParams.get('country') === 'Kenya' && url.searchParams.get('pendingReview') === 'true' && url.searchParams.get('cohortId') === cohortId)).toBe(true);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Filter briefs by country' })).toContainText('All countries');
  await expect(page.getByRole('link', { name: 'Ghana problem', exact: true })).toBeVisible();
});

test('CSV export includes Country and fetches every page using the selected country and pending filter', async ({ page, context }) => {
  const requests = await setup(page, context);
  await selectKenya(page);
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('button', { name: /^Pending Review/ }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloaded;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.split('\n')[0]).toContain('Title,Partner,Country,Vertical');
  expect(csv).toContain('Kenya problem,Ghana partner,Kenya');
  expect(csv).toContain('Legacy Kenya problem,Kenya partner,Kenya');
  expect(csv).not.toContain('Ghana problem,');
  const exports = requests.filter(url => url.searchParams.get('limit') === '500');
  expect(exports.map(url => url.searchParams.get('page'))).toEqual(['1', '2']);
  expect(exports.every(url => url.searchParams.get('country') === 'Kenya' && url.searchParams.get('pendingReview') === 'true')).toBe(true);
});
