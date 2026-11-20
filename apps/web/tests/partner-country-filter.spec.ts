import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const cohortId = '318cb096-48d3-4d3b-8db6-4ef6e6c21356';
const countryNames: Record<string, string> = { GH: 'Ghana', KE: 'Kenya' };
const partners = [
  { id: 'ghana-approved', name: 'Ghana Health Partner', country: 'GH', status: 'approved', isActive: true },
  { id: 'ghana-pending', name: 'Ghana Education Partner', country: 'Ghana', status: 'pending', isActive: true },
  { id: 'kenya-approved', name: 'Kenya Partner', country: 'KE', status: 'approved', isActive: true },
  { id: 'ghana-inactive', name: 'Ghana Inactive Partner', country: 'Ghana', status: 'approved', isActive: false },
].map(p => ({ ...p, cohortId, email: `${p.id}@example.test`, createdAt: '2026-11-01T12:00:00Z' }));

async function setup(page: Page, context: BrowserContext, role = 'program_manager') {
  const user = { id: 'country-staff', role, email: 'staff@example.test', firstName: 'Test' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'staff', isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  const requests: URL[] = [], sent: unknown[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    requests.push(url);
    const selected = partners.filter(p => (!url.searchParams.get('country') || (countryNames[p.country] || p.country) === url.searchParams.get('country'))
      && p.name.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()));
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/cohorts')) data = { data: [{ id: cohortId, name: 'Country cohort', status: 'active', countries: ['GH', 'KE'] }], total: 1 };
    else if (path.endsWith('/organizations/statistics')) data = { total: selected.length, pending: selected.filter(p => p.status === 'pending').length, approved: selected.filter(p => p.status === 'approved').length, rejected: 0 };
    else if (path.endsWith('/organizations')) {
      const rows = selected.filter(p => !url.searchParams.get('status') || p.status === url.searchParams.get('status'));
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const pageSize = url.searchParams.get('limit') === '500' ? 1 : 2;
      data = { data: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: rows.length, totalPages: Math.ceil(rows.length / pageSize), page: pageNumber };
    } else if (path.endsWith('/resend-eligible-invites')) {
      sent.push(route.request().postDataJSON());
      data = { id: 'country-batch', state: 'queued', total: 1, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    } else if (path.endsWith('/invite-resends/country-batch')) data = { id: 'country-batch', state: 'completed', total: 1, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] };
    await route.fulfill({ json: data });
  });
  await page.goto('/staff/partners');
  await expect(page.getByRole('link', { name: 'Ghana Health Partner', exact: true })).toBeVisible();
  return { requests, sent };
}
async function country(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Filter partners by country' }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

test('country resets pagination and selection, scopes counts, combines with search/status and clears', async ({ page, context }) => {
  const { requests } = await setup(page, context);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Kenya Partner', exact: true }).check();
  await expect(page.getByText('1 selected on this page')).toBeVisible();
  await country(page, 'Kenya');
  await expect(page.getByRole('link', { name: 'Kenya Partner', exact: true })).toBeVisible();
  await expect(page.getByText('1 selected on this page')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Select Kenya Partner', exact: true })).not.toBeChecked();
  await expect(page.getByText('Total', { exact: true }).locator('..')).toHaveText('Total1');
  await expect.poll(() => requests.some(url => url.pathname.endsWith('/organizations') && url.searchParams.get('country') === 'Kenya' && url.searchParams.get('page') === '1')).toBe(true);
  await country(page, 'Ghana');
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ghana Education Partner', exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Search partners...').fill('Health');
  await expect(page.getByRole('link', { name: 'Ghana Health Partner', exact: true })).toBeVisible();
  await expect(page.getByText('Total', { exact: true }).locator('..')).toHaveText('Total1');
  await expect.poll(() => requests.some(url => url.pathname.endsWith('/organizations') && url.searchParams.get('country') === 'Ghana' && url.searchParams.get('status') === 'approved' && url.searchParams.get('search') === 'Health')).toBe(true);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Filter partners by country' })).toContainText('All countries');
  await page.getByPlaceholder('Search partners...').fill('');
  await expect(page.getByRole('link', { name: 'Ghana Education Partner', exact: true })).toBeVisible();
});

test('country-filtered export fetches every valid page with the current cohort and search', async ({ page, context }) => {
  const { requests } = await setup(page, context);
  await country(page, 'Ghana');
  await page.getByPlaceholder('Search partners...').fill('Partner');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const csv = await readFile((await (await downloaded).path())!, 'utf8');
  expect(csv).toContain('Ghana Health Partner');
  expect(csv).toContain('Ghana Education Partner');
  expect(csv).toContain('Ghana Inactive Partner');
  expect(csv).not.toContain('Kenya Partner');
  const exports = requests.filter(url => url.pathname.endsWith('/organizations') && url.searchParams.get('limit') === '500');
  expect(exports.map(url => url.searchParams.get('page'))).toEqual(['1', '2', '3']);
  expect(exports.every(url => url.searchParams.get('country') === 'Ghana' && url.searchParams.get('cohortId') === cohortId && url.searchParams.get('search') === 'Partner')).toBe(true);
});

test('bulk resend remains limited to the selected country and cohort', async ({ page, context }) => {
  const { sent } = await setup(page, context);
  await country(page, 'Ghana');
  await page.getByRole('button', { name: 'Resend approved invites', exact: true }).click();
  await page.getByRole('button', { name: 'Send invitations', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ country: 'Ghana', cohortId });
});

test('read-only staff can filter partners without gaining invitation actions', async ({ page, context }) => {
  await setup(page, context, 'viewer');
  await country(page, 'Kenya');
  await expect(page.getByRole('link', { name: 'Kenya Partner', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend approved invites', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});
