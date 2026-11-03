import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { page.on('pageerror', error => console.error('Browser exception:', error.message)); });

test('partner magic login and resend use the organization API contract', async ({ page }) => {
  const requests: unknown[] = [];
  await page.route('**/auth/magic-link', async route => { requests.push(route.request().postDataJSON()); await route.fulfill({ json: { message: 'Sent' } }); });
  await page.goto('/partners/login');
  await page.getByLabel(/email/i).fill('partner@example.test');
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  await expect(page.getByText(/verification code/i).first()).toBeVisible();
  await page.getByRole('button', { name: /resend/i }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests).toEqual([{ email: 'partner@example.test', portal: 'organization' }, { email: 'partner@example.test', portal: 'organization' }]);
});

test('retired portal URLs redirect to current login routes', async ({ page }) => {
  for (const [oldPath, current] of [['/app/dashboard', '/participant/login'], ['/org/briefs', '/partners/login'], ['/portal/dashboard', '/staff/login']]) {
    await page.goto(oldPath);
    await expect(page).toHaveURL(new RegExp(current));
  }
});

test('invalid portal cookies cannot crash login routing', async ({ context, page }) => {
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: '__proto__', url: 'http://localhost:63781' }]);
  const response = await page.goto('/participant/login');
  expect(response?.status()).toBeLessThan(500);
});

test('persisted brief HTML preserves formatting without executing handlers', async ({ context, page }) => {
  const user = { id: 'participant-uuid', email: 'participant@example.test', role: 'participant', firstName: 'Test', lastName: 'Participant', onboardingComplete: true };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user }) => {
    localStorage.setItem('auth_token', 'test-access');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-access', portal: 'participant', isAuthenticated: true }, version: 0 }));
  }, { user });
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/me')) data = user;
    else if (pathname.endsWith('/participants/me')) data = { ...user, participantId: 'ATF-001', cohortId: 'cohort-1', onboardingComplete: true };
    else if (pathname.endsWith('/briefs/test-brief')) data = { id: 'test-brief', title: 'Security regression brief', maxTeams: 3, teamsCount: 0, tags: [], description: '<p><strong>Supported formatting</strong><img src=x onerror="window.compromised=true"><script>window.compromised=true</script><a href="javascript:window.compromised=true">Unsafe link</a></p>' };
    else if (pathname.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/participant/briefs/test-brief');
  await expect(page.locator('strong').filter({ hasText: 'Supported formatting' })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { compromised?: boolean }).compromised)).toBeUndefined();
  expect(await page.getByText('Unsafe link', { exact: true }).getAttribute('href')).toBeNull();
});
