import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => { const messages: string[] = []; errors.set(page, messages); page.on('pageerror', error => messages.push(error.message)); });
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

const origin = 'http://localhost:63781';
const user = { id: 'recovery-staff', email: 'recovery@example.test', role: 'viewer', firstName: 'Recovery', lastName: 'Verifier' };

async function session(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: 'auth_token', value: 'present', url: origin }, { name: 'auth_portal', value: 'staff', url: origin }]);
  await page.addInitScript(user => {
    if (sessionStorage.getItem('recovery-seeded')) return;
    sessionStorage.setItem('recovery-seeded', 'yes');
    localStorage.setItem('auth_token', 'recovery-access');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'recovery-access', portal: 'staff', isAuthenticated: true }, version: 0 }));
  }, user);
  await page.route('**/*onesignal*', route => route.abort());
  await page.routeWebSocket(/socket\.io/, socket => socket.close());
}

async function backend(page: Page, state: { unavailable: boolean }) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/setup/status')) return route.fulfill({ json: { isSetupComplete: true } });
    if (path.endsWith('/chat/channels/my')) return route.fulfill({ json: [] });
    if (path.endsWith('/auth/me')) return route.fulfill(state.unavailable ? { status: 503, json: { message: 'Session verification temporarily unavailable' } } : { json: user });
    if (path.endsWith('/auth/logout')) return route.fulfill({ json: { message: 'Logged out' } });
    if (path.endsWith('/participants')) return route.fulfill({ json: { data: [], total: 0, totalPages: 1 } });
    if (path.endsWith('/cohorts')) return route.fulfill({ json: { data: [], total: 0 } });
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: { data: [], total: 0 } });
  });
}

test('corrupted saved session recovers to the portal chooser on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: 'auth_token', value: 'present', url: origin }, { name: 'auth_portal', value: 'staff', url: origin }]);
  await page.addInitScript(() => { localStorage.setItem('acmp-auth-store', '{invalid JSON'); localStorage.setItem('auth_token', 'old-access'); });
  await page.route('**/*onesignal*', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose Your Portal' })).toBeVisible({ timeout: 5000 });
  expect((await context.cookies()).some(cookie => cookie.name === 'auth_token')).toBe(false);
});

test('back to login escapes failed staff verification without a redirect loop', async ({ page, context }) => {
  await session(page, context);
  await backend(page, { unavailable: true });
  await page.goto('/staff/participants');
  await expect(page.getByText('Unable to verify your access.')).toBeVisible();
  await page.getByText('Back to login', { exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/login(?:\?|$)/, { timeout: 5000 });
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
});

test('a temporary verification error never exposes protected content and retry recovers', async ({ page, context }) => {
  await session(page, context);
  const state = { unavailable: true }; await backend(page, state);
  await page.goto('/staff/participants');
  await expect(page.getByText('Unable to verify your access.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Participants', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBe('recovery-access');
  state.unavailable = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Participants', exact: true })).toBeVisible();
});

for (const saved of ['null', JSON.stringify({ state: { user: { id: 'old', role: 'viewer' }, token: 'old', portal: 'unknown', isAuthenticated: true }, version: 0 })]) {
  test(`invalid saved session shape recovers safely: ${saved.slice(0, 12)}`, async ({ page }) => {
    await page.addInitScript(saved => localStorage.setItem('acmp-auth-store', saved), saved);
    await page.route('**/*onesignal*', route => route.abort());
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Choose Your Portal' })).toBeVisible();
  });
}

test('blocked browser storage stops loading and rejects sign-in without exposing staff pages', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage is blocked', 'SecurityError'); } }));
  await page.route('**/*onesignal*', route => route.abort());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/setup/status') ? { isSetupComplete: true } : { accessToken: 'new-access', user } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose Your Portal' })).toBeVisible();
  await page.goto('/staff/login');
  await page.locator('input[type=email]').fill('recovery@example.test');
  await page.locator('input[type=password]').fill('Synthetic-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Your browser could not save your session. Allow cookies and site storage, then try again.')).toBeVisible();
  await expect(page).toHaveURL(/\/staff\/login$/);
});

test('an expired session returns to login and cannot expose staff content', async ({ page, context }) => {
  await session(page, context); await backend(page, { unavailable: false });
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { message: 'Session expired' } }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: { message: 'Session credential is missing' } }));
  await page.goto('/staff/participants');
  await expect(page).toHaveURL(/\/staff\/login(?:\?|$)/);
  await expect(page.locator('input[type=password]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Participants', exact: true })).toHaveCount(0);
});


test('a saved staff session can open the landing page without hydration errors', async ({ page, context }) => {
  await session(page, context); await backend(page, { unavailable: true });
  await page.goto('/');
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await expect(page.getByText('Unable to verify your access.')).toBeVisible();
});
