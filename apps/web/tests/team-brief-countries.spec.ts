import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const cohortId = 'country-cohort';
const countryNames = ['Ghana', 'Nigeria', 'Kenya', 'South Africa'];
const briefs = countryNames.map((country, index) => ({ id: `brief-${index}`, title: `${country} challenge`, problemCountry: country, cohortId, description: `Build a solution in ${country}`, organization: { id: 'partner', name: 'Challenge partner', country: 'Ghana' }, vertical: { id: 'health', name: 'Health' }, status: 'approved', maxTeams: 5, teamsCount: 0, imageUrls: [], tags: [], createdAt: '2026-11-01T00:00:00Z' }));
async function setup(page: Page, context: BrowserContext, options: { role?: 'lead' | 'member'; ownCountry?: string; teamless?: boolean; ranking?: boolean } = {}) {
  const self = { id: 'self', participantId: 'ATF-SELF', firstName: 'Example', lastName: 'Member', email: 'self@example.test', role: 'participant', country: options.ownCountry || 'Ghana', cohortId, onboardingComplete: true, mustChangePassword: false, isActive: true, skills: [], interests: [] };
  let countries = options.teamless ? [self.country] : [...countryNames];
  let roster = countries.map((country, index) => ({ id: `member-${index}`, participantId: index ? `participant-${index}` : self.id, role: index ? 'member' : options.role || 'lead', status: 'confirmed', participant: { id: index ? `participant-${index}` : self.id, firstName: 'Example', lastName: 'Member', country, cohortId, skills: [] } }));
  const requests: URL[] = [], saved: string[][] = [];
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'participant', isAuthenticated: true }, version: 0 }));
  }, self);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    requests.push(url);
    let data: unknown = [];
    if (path.endsWith('/auth/me') || path.endsWith('/participants/me')) data = self;
    else if (path.endsWith('/teams/my/self')) {
      if (options.teamless) { await route.fulfill({ status: 200, body: '' }); return; }
      data = { id: 'mixed-team', name: 'Mixed-country team', competitionCountry: 'Ghana', cohortId, members: roster };
    } else if (path.endsWith('/briefs/approved')) data = briefs.filter(brief => countries.includes(brief.problemCountry) && (!url.searchParams.get('search') || brief.title.toLowerCase().includes(url.searchParams.get('search')!.toLowerCase())));
    else if (path.endsWith('/brief-rankings') && route.request().method() === 'PUT') {
      saved.push(route.request().postDataJSON().briefRankings); data = { briefRankings: saved.at(-1) };
    } else if (path.endsWith('/preferences')) data = { briefRankings: [briefs[1].id], crossCountryWilling: true };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto(options.ranking ? '/participant/briefs/rank' : '/participant/briefs');
  return { requests, saved, removeCountry: (country: string) => { countries = countries.filter(value => value !== country); roster = roster.filter(member => member.participant.country !== country); } };
}

for (const role of ['lead', 'member'] as const) {
  test(`${role} can browse briefs from all four confirmed member countries`, async ({ page, context }) => {
    await setup(page, context, { role, ownCountry: role === 'lead' ? 'Ghana' : 'Nigeria' });
    for (const country of countryNames) {
      await expect(page.getByRole('heading', { name: `${country} challenge`, exact: true })).toBeVisible();
      await expect(page.getByText(country, { exact: true })).toBeVisible();
    }
    await page.getByRole('heading', { name: 'Nigeria challenge', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  });
}

test('a teamless participant browses only their own country', async ({ page, context }) => {
  await setup(page, context, { teamless: true, ownCountry: 'Nigeria' });
  await expect(page.getByRole('heading', { name: 'Nigeria challenge', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ghana challenge', exact: true })).toHaveCount(0);
});

test('a mixed team can search for another member country without sending a lead-country filter', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByPlaceholder('Search briefs...').fill('Nigeria');
  await expect(page.getByRole('heading', { name: 'Nigeria challenge', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ghana challenge', exact: true })).toHaveCount(0);
  expect(state.requests.filter(url => url.pathname.endsWith('/briefs/approved')).every(url => !url.searchParams.has('country'))).toBe(true);
});

test('ranking includes every team country and saves teammate-country preferences', async ({ page, context }) => {
  const state = await setup(page, context, { ranking: true });
  for (const country of countryNames) await expect(page.getByRole('heading', { name: `${country} challenge`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 }).first()).toHaveText('Nigeria challenge');
  const firstHandle = page.locator('[aria-roledescription="sortable"]').first();
  const first = (await firstHandle.boundingBox())!;
  const second = (await page.locator('[aria-roledescription="sortable"]').nth(1).boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2 + 12, { steps: 3 });
  await expect(firstHandle).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 10 });
  await expect(page.getByRole('status')).toContainText('over droppable area brief-0');
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Nigeria challenge', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Save Rankings', exact: true })).toBeEnabled();
  // dnd-kit retains its document click suppressor for 50 ms after pointer release.
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Save Rankings', exact: true }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  expect(state.saved[0].sort()).toEqual(briefs.map(brief => brief.id).sort());
});

test('ranking refresh removes departed member countries without losing remaining choices', async ({ page, context }) => {
  await page.clock.install();
  const state = await setup(page, context, { ranking: true });
  await expect(page.getByRole('heading', { name: 'South Africa challenge', exact: true })).toBeVisible();
  state.removeCountry('South Africa');
  // Exercise the ordinary focus refetch while the ranking screen stays mounted.
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await page.clock.runFor(100);
  await expect(page.getByRole('heading', { name: 'South Africa challenge', exact: true })).toHaveCount(0);
  for (const country of countryNames.slice(0, 3)) await expect(page.getByRole('heading', { name: `${country} challenge`, exact: true })).toBeVisible();
});

test('staff assignment offers all confirmed member countries and excludes pending-only countries', async ({ page, context }) => {
  const user = { id: 'staff', role: 'program_manager', firstName: 'Example', lastName: 'Staff', email: 'staff@example.test' };
  const team = { id: 'mixed-team', name: 'Mixed-country team', cohortId, cohort: { id: cohortId, name: 'Country cohort' }, competitionCountry: 'Ghana', status: 'forming', inviteCode: 'TEST1234', createdAt: '2026-11-01T00:00:00Z', members: [...countryNames, 'Togo'].map((country, index) => ({ id: `member-${index}`, participantId: `participant-${index}`, role: index ? 'member' : 'lead', status: country === 'Togo' ? 'pending' : 'confirmed', participant: { id: `participant-${index}`, firstName: 'Example', lastName: 'Member', country, email: `member${index}@example.test`, skills: [] } })) };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'staff', url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'staff', isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/cohorts')) data = { data: [team.cohort], total: 1 };
    else if (path.endsWith('/teams/mixed-team')) data = team;
    else if (path.endsWith('/briefs/approved')) data = [...briefs, { ...briefs[0], id: 'togo', title: 'Togo challenge', problemCountry: 'Togo' }];
    else if (path.endsWith('/sessions')) data = { upcoming: [], past: [] };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/staff/teams/mixed-team');
  await page.getByRole('button', { name: 'Assign Brief', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('combobox').click();
  for (const country of countryNames) await expect(page.getByRole('option', { name: new RegExp(`${country} challenge`) })).toBeVisible();
  await expect(page.getByRole('option', { name: /Togo challenge/ })).toHaveCount(0);
});
