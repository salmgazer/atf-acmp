import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const titles = (count: number) => Array.from({ length: count }, (_, index) => `Brief ${String(index + 1).padStart(2, '0')}`);
const self = { id: 'ranking-participant', participantId: 'TEST-RANKING', firstName: 'Example', lastName: 'Participant', email: 'ranking@example.test', country: 'Ghana', cohortId: 'ranking-cohort', role: 'participant', onboardingComplete: true, mustChangePassword: false, skills: [], interests: [] };
async function setup(page: Page, context: BrowserContext, options: { count?: number; saved?: string[]; holdFirstSave?: boolean; preferencesFail?: boolean; saveFail?: boolean } = {}) {
  const count = options.count ?? 8;
  const briefs = titles(count).map((title, index) => ({ id: `brief-${index + 1}`, title, cohortId: self.cohortId, problemCountry: 'Ghana', description: 'Example problem', organization: { id: 'partner', name: 'Partner', country: 'Ghana' }, vertical: { id: 'health', name: 'Health' }, status: 'approved', maxTeams: 5, teamsCount: 0, imageUrls: [], tags: [] }));
  let saved = options.saved || [], release: (() => void) | undefined, preferencesFail = !!options.preferencesFail, saveFail = !!options.saveFail;
  const writes: string[][] = [];
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'participant', isAuthenticated: true }, version: 0 }));
  }, self);
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/me') || path.endsWith('/participants/me')) data = self;
    else if (path.endsWith('/teams/my/' + self.id)) data = { id: 'ranking-team', cohortId: self.cohortId, members: [{ id: 'member', participantId: self.id, role: 'lead', status: 'confirmed', participant: self }] };
    else if (path.endsWith('/briefs/approved')) data = briefs;
    else if (path.endsWith('/preferences')) {
      if (preferencesFail) { await route.fulfill({ status: 400, json: { message: 'Could not read saved preferences' } }); return; }
      data = { briefRankings: saved };
    } else if (path.endsWith('/brief-rankings') && request.method() === 'PUT') {
      const ids = request.postDataJSON().briefRankings;
      writes.push([...ids]);
      if (options.holdFirstSave && writes.length === 1) await new Promise<void>(resolve => { release = resolve; });
      if (saveFail) { await route.fulfill({ status: 400, json: { message: 'Ranking was not saved. Please try again.' } }); return; }
      saved = [...ids]; data = { briefRankings: saved };
    } else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/participant/briefs/rank');
  if (!options.preferencesFail) await expect(page.getByRole('heading', { level: 3 })).toHaveCount(count);
  return { writes, release: () => release?.(), recoverPreferences: () => { preferencesFail = false; }, recoverSave: () => { saveFail = false; } };
}
const save = (page: Page) => page.getByRole('button', { name: 'Save Rankings', exact: true });
const rank = (page: Page, number: number) => page.getByRole('combobox', { name: `Rank for Brief ${String(number).padStart(2, '0')}`, exact: true });
const order = (page: Page) => page.locator('[aria-roledescription="sortable"]').evaluateAll(handles => handles.map(handle => handle.parentElement!.querySelector('h3')!.textContent));

for (const count of [1, 5]) test(`fresh ${count}-brief ranking can save its displayed order without dragging`, async ({ page, context }) => {
  const state = await setup(page, context, { count });
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toEqual(Array.from({ length: count }, (_, index) => `brief-${index + 1}`));
  await expect(save(page)).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(count);
  await expect(save(page)).toBeDisabled();
});

test('new edits made during a slow save remain unsaved and can be persisted', async ({ page, context }) => {
  const state = await setup(page, context, { holdFirstSave: true });
  await rank(page, 2).selectOption('1');
  await save(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await rank(page, 3).selectOption('1');
  expect((await order(page))[0]).toBe('Brief 03');
  state.release();
  await expect(save(page)).toBeEnabled();
  await expect(page.getByText('Your current preferences have unsaved changes.', { exact: true })).toBeVisible();
  await save(page).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes).toEqual([['brief-2', 'brief-1', 'brief-3', 'brief-4', 'brief-5'], ['brief-3', 'brief-2', 'brief-1', 'brief-4', 'brief-5']]);
  await expect(save(page)).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { level: 3 }).first()).toHaveText('Brief 03');
});

test('mobile rank selectors move an outside brief into the top five without dragging', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, context);
  await page.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const last = (await rank(page, 8).boundingBox())!;
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), { x: last.x + last.width / 2, y: last.y + last.height / 2 })).toBe('Rank for Brief 08');
  await rank(page, 8).selectOption('1');
  await expect(page.getByRole('heading', { level: 3 }).first()).toHaveText('Brief 08');
  const handle = page.getByRole('button', { name: 'Drag Brief 08 to reorder', exact: true });
  const box = (await handle.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await save(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toEqual(['brief-8', 'brief-1', 'brief-2', 'brief-3', 'brief-4']);
});

test('mouse dragging promotes another available brief into first preference', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1180 });
  await setup(page, context);
  const source = (await page.getByRole('button', { name: 'Drag Brief 06 to reorder', exact: true }).boundingBox())!;
  const target = (await page.getByRole('button', { name: 'Drag Brief 01 to reorder', exact: true }).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 - 12, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole('heading', { level: 3 }).first()).toHaveText('Brief 06');
});

test('keyboard moves cross the top-five boundary and cancellation releases the controls', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1180 });
  await setup(page, context, { saved: ['brief-1', 'brief-2', 'brief-3', 'brief-4', 'brief-5'] });
  const handle = page.getByRole('button', { name: 'Drag Brief 05 to reorder', exact: true });
  await handle.focus(); await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('status')).toContainText('over droppable area brief-6');
  await page.keyboard.press('Space');
  await expect(rank(page, 5)).toHaveValue('6');
  await expect(rank(page, 6)).toHaveValue('5');
  await page.waitForTimeout(300);
  await handle.focus(); await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await expect(rank(page, 5)).toBeEnabled();
  await expect(save(page)).toBeEnabled();
});

test('failed preference reads prevent overwriting saved rankings and can be retried', async ({ page, context }) => {
  const state = await setup(page, context, { preferencesFail: true });
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load your briefs or saved rankings' })).toBeVisible();
  await expect(save(page)).toBeDisabled();
  state.recoverPreferences(); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);
  await expect(save(page)).toBeEnabled(); expect(state.writes).toEqual([]);
});

test('a failed save keeps the edited order available for retry', async ({ page, context }) => {
  const state = await setup(page, context, { saveFail: true });
  await rank(page, 4).selectOption('1'); await save(page).click();
  await expect(page.getByText('Ranking was not saved. Please try again.', { exact: true })).toBeVisible();
  await expect(save(page)).toBeEnabled(); await expect(rank(page, 4)).toHaveValue('1');
  state.recoverSave(); await save(page).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1][0]).toBe('brief-4'); await expect(save(page)).toBeDisabled();
});

test('empty brief lists cannot be accidentally saved', async ({ page, context }) => {
  const state = await setup(page, context, { count: 0 });
  await expect(page.getByText('No approved briefs are currently available to rank.', { exact: true })).toBeVisible();
  await expect(save(page)).toBeDisabled(); expect(state.writes).toEqual([]);
});

test('touch dragging from a long list scrolls into first preference and saves', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch gesture dispatch uses Chromium CDP');
  const context = await browser.newContext({ baseURL: 'http://localhost:63781', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(), state = await setup(page, context, { count: 20 });
    const source = page.getByRole('button', { name: 'Drag Brief 18 to reorder', exact: true });
    await source.scrollIntoViewIfNeeded();
    await source.evaluate(el => {
      const main = document.querySelector('main')!;
      main.scrollTop += el.getBoundingClientRect().top - main.getBoundingClientRect().top - 160;
    });
    const first = (await page.getByRole('button', { name: 'Drag Brief 01 to reorder', exact: true }).boundingBox())!;
    const initialScroll = await page.locator('main').evaluate(el => el.scrollTop);
    const a = (await source.boundingBox())!, main = (await page.locator('main').boundingBox())!;
    const x = a.x + a.width / 2, y = a.y + a.height / 2, edge = main.y + 5;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
    for (let step = 1; step <= 16; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (edge - y) * step / 16, id: 0 }] });
      await page.waitForTimeout(16);
    }
    await expect.poll(() => page.locator('main').evaluate(el => el.scrollTop)).toBe(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: first.x + first.width / 2, y: first.y + first.height / 2 + initialScroll, id: 0 }] });
    await expect(page.getByRole('status')).toContainText('over droppable area brief-1');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(rank(page, 18)).toHaveValue('1');
    await page.waitForTimeout(100);
    await save(page).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0]).toEqual(['brief-18', 'brief-1', 'brief-2', 'brief-3', 'brief-4']);
  } finally { await context.close(); }
});
