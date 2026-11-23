import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const self = { id: 'lead', participantId: 'LMS-LEAD', firstName: 'Team', lastName: 'Lead', email: 'lead@example.test', cohortId: 'cohort', role: 'participant', country: 'Ghana', group: 'A', onboardingComplete: true, mustChangePassword: false, skills: [], interests: [] };
const candidate = { id: 'candidate', firstName: 'Ada', lastName: 'Builder', country: 'Ghana', skills: ['Python', 'Data analysis'], interests: ['Health'] };
const profile = { ...candidate, phoneNumber: "+233201234567", whatsappNumber: "+233209876543", institution: 'Example University', educationLevel: 'Degree', fieldOfStudy: 'Medicine', currentAffiliation: 'Graduate', pythonSkill: 'Advanced', gitSkill: 'Intermediate', aiExperience: 'Some experience', githubUsername: 'octocat', qualifiedBuilder: true, nonComputingStudy: true, matching: { preferredRole: 'builder', buildDeployAbility: 'confident', firstChoiceSector: 'health', backupSector: 'education', crossCountryWilling: true, teamStatus: 'need_team' } };
const member = (id: string, participant: { id: string; firstName: string; lastName: string; country: string }, status = 'confirmed', role = 'member') => ({ id, teamId: 'team', participantId: participant.id, participant, status, role, joinedAt: '2026-11-01T12:00:00Z' });
const team = { id: 'team', name: 'Profile team', status: 'forming', cohortId: 'cohort', group: 'A', competitionCountry: 'Ghana', cohort: { id: 'cohort', name: 'Cohort', teamSizeMax: 5 }, inviteCode: 'TEAM1234', members: [member('lead-row', self, 'confirmed', 'lead'), member('pending-row', candidate, 'pending')], createdAt: '2026-11-01T12:00:00Z' };
async function setup(page: Page, context: BrowserContext, options: { noTeam?: boolean; private?: boolean; longMember?: boolean; noContacts?: boolean } = {}) {
  let shared = !options.private;
  let profileReads = 0;
  const writes: string[] = [];
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'participant', isAuthenticated: true }, version: 0 }));
  }, self);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    let data: unknown = [];
    if (method !== 'GET') writes.push(path);
    if (path.endsWith('/auth/me') || path.endsWith('/participants/me')) data = self;
    else if (path.endsWith('/teams/my/lead')) data = options.noTeam ? null : options.longMember ? { ...team, members: [team.members[0], member('long-row', { ...candidate, firstName: 'Alexanderthelongfirstname', lastName: 'Verylongfamilyname' })] } : team;
    else if (path.endsWith('/teams/participants/candidate/profile')) {
      profileReads++;
      if (!shared) { await route.fulfill({ status: 404, json: { message: 'This matching profile is not available. The participant may not have enabled profile sharing.' } }); return; }
      data = options.noContacts ? { ...profile, phoneNumber: null, whatsappNumber: null } : profile;
    } else if (path.endsWith('/teams/team/eligibility')) data = { registrationIssues: [], challengeIssues: [], guidance: [], competitionCountries: ['Ghana'], teamSize: 1, builderCount: 1, nonComputingCount: 0, femaleCount: 0, institutionCount: 1 };
    else if (path.endsWith('/teams/search/participants')) data = [candidate];
    else if (path.endsWith('/teams/open/cohort')) data = [{ ...team, members: [member('candidate-row', candidate, 'confirmed', 'lead')] }];
    else if (path.endsWith('/pending-row/confirm')) data = { ...team.members[1], status: 'confirmed' };
    else if (path.endsWith('/teams/team/invitations') && method === 'POST') data = { id: 'invitation', participantId: candidate.id, status: 'pending' };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/participant/team');
  return { reads: () => profileReads, writes, revoke: () => { shared = false; } };
}
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Participant profile', exact: true });

test('lead reviews the pending applicant profile before approving without profile viewing changing membership', async ({ page, context }) => {
  const state = await setup(page, context);
  expect(state.reads()).toBe(0);
  await page.getByRole('button', { name: 'View profile for Ada Builder', exact: true }).click();
  await expect(dialog(page).getByRole('heading', { name: 'Ada Builder', exact: true })).toBeVisible();
  await expect(dialog(page)).toContainText('Example University');
  await expect(dialog(page).getByText('Phone number', { exact: true }).locator('..')).toHaveText('Phone number+233201234567');
  await expect(dialog(page).getByText('WhatsApp number', { exact: true }).locator('..')).toHaveText('WhatsApp number+233209876543');
  await expect(dialog(page)).toContainText('Medicine');
  await expect(dialog(page)).toContainText('Yes, confidently');
  await expect(dialog(page).getByText('Qualified builder', { exact: true }).locator('..')).toHaveText('Qualified builderYes');
  await expect(dialog(page).getByRole('link', { name: 'octocat on GitHub' })).toHaveAttribute('href', 'https://github.com/octocat');
  expect(state.writes).toEqual([]);
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect.poll(() => state.writes.some(path => path.endsWith('/pending-row/confirm'))).toBe(true);
});

test('invite search allows profile review in a nested dialog and returns to the invitation action', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  const invites = page.getByRole('dialog', { name: 'Invite Participants', exact: true });
  await invites.getByPlaceholder('Search by name or email...').fill('Ada');
  await invites.getByRole('button', { name: 'View profile for Ada Builder', exact: true }).click();
  await expect(dialog(page).getByText('Advanced', { exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(invites).toBeVisible();
  await invites.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect.poll(() => state.writes.some(path => path.endsWith('/teams/team/invitations'))).toBe(true);
});

test('teamless participants inspect open-team members and profile dialogs fit a mobile viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, context, { noTeam: true });
  await page.getByRole('article', { name: 'Profile team', exact: true }).getByRole('button', { name: 'View profile for Ada Builder', exact: true }).click();
  await expect(dialog(page).getByRole('heading', { name: 'Ada Builder', exact: true })).toBeVisible();
  const box = await dialog(page).boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  expect(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(state.writes).toEqual([]);
});

test('reopening a profile after consent withdrawal does not redisplay the previous profile', async ({ page, context }) => {
  const state = await setup(page, context);
  const open = page.getByRole('button', { name: 'View profile for Ada Builder', exact: true });
  await open.click();
  await expect(dialog(page)).toContainText('Example University');
  await expect(dialog(page).getByText('Phone number', { exact: true }).locator('..')).toHaveText('Phone number+233201234567');
  await expect(dialog(page).getByText('WhatsApp number', { exact: true }).locator('..')).toHaveText('WhatsApp number+233209876543');
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
  state.revoke();
  await open.click();
  await expect(dialog(page).getByRole('alert')).toContainText('not available');
  await expect(dialog(page)).not.toContainText('Example University');
  await expect(dialog(page)).not.toContainText(profile.phoneNumber);
  await expect(dialog(page)).not.toContainText(profile.whatsappNumber);
  expect(state.reads()).toBe(2);
  expect(state.writes).toEqual([]);
});

test('member profile controls and long names fit the mobile team dashboard', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, context, { longMember: true });
  await expect(page.getByRole('button', { name: 'View profile for Alexanderthelongfirstname Verylongfamilyname', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('missing contact numbers are clearly shown without hiding the profile', async ({ page, context }) => {
  await setup(page, context, { noContacts: true });
  await page.getByRole('button', { name: 'View profile for Ada Builder', exact: true }).click();
  await expect(dialog(page).getByText('Phone number', { exact: true }).locator('..')).toHaveText('Phone numberNot provided');
  await expect(dialog(page).getByText('WhatsApp number', { exact: true }).locator('..')).toHaveText('WhatsApp numberNot provided');
  await expect(dialog(page)).toContainText('Example University');
});
