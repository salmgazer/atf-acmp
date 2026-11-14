import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const selfId = 'team-applicant', cohortId = 'joining-cohort';
const self = { id: selfId, participantId: 'LMS-APPLICANT', email: 'applicant@example.test', firstName: 'Example', lastName: 'Applicant', role: 'participant', cohortId, group: 'A', country: 'Ghana', status: 'ready', isActive: true, onboardingComplete: true, mustChangePassword: false, skills: [], interests: [] };
function team(id: string, count: number, pending = false, max = 5) {
  return { id, name: id, cohortId, group: 'A', cohort: { id: cohortId, name: 'Cohort', teamSizeMax: max }, status: 'forming', inviteCode: 'JOIN1234', createdAt: '2026-11-01T00:00:00Z', members: [
    ...Array.from({ length: count }, (_, index) => ({ id: `${id}-${index}`, teamId: id, participantId: `${id}-${index}`, role: index === 0 ? 'lead' : 'member', status: 'confirmed', joinedAt: '2026-11-01T00:00:00Z', participant: { id: `${id}-${index}`, firstName: `Confirmed${index}`, lastName: 'Member', country: 'Ghana', skills: [] } })),
    ...(pending ? [{ id: 'pending-self', teamId: id, participantId: selfId, role: 'member', status: 'pending', joinedAt: '2026-11-01T00:00:00Z', participant: { ...self, firstName: 'PendingApplicant' } }] : []),
  ] };
}
async function setup(page: Page, context: BrowserContext, options: { current?: ReturnType<typeof team>; open?: ReturnType<typeof team>[]; noTeamResponse?: 'empty' | 'json-null'; failWithdraw?: boolean; approveDuringWithdrawal?: boolean; memberArrivesOnLeave?: boolean } = {}) {
  let current = options.current || null;
  const open = options.open || [], requests: { method: string; path: string }[] = [];
  let withdrawals = 0;
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => { localStorage.setItem('auth_token', 'test-token'); localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'participant', isAuthenticated: true }, version: 0 })); }, self);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    requests.push({ path, method });
    let data: unknown = [];
    if (path.endsWith('/auth/me') || path.endsWith('/participants/me')) data = self;
    else if (path.endsWith(`/teams/my/${selfId}`)) {
      // NestJS sends an empty HTTP body when the controller returns null.
      if (!current && options.noTeamResponse !== 'json-null') {
        await route.fulfill({ status: 200, body: '' }); return;
      }
      data = current;
    }
    else if (path.endsWith(`/teams/open/${cohortId}`)) data = open;
    else if (path.endsWith('/teams/join') && method === 'POST') {
      current = { ...team('requested-team', 1, true), name: 'Requested team' }; data = current;
    } else if ((path.endsWith(`/members/${selfId}`) || path.endsWith('/join-request')) && method === 'DELETE') {
      withdrawals++;
      if (options.memberArrivesOnLeave && current) {
        current.members.push(team('New teammate', 1).members[0]);
        await route.fulfill({ status: 400, json: { message: 'Team leads can only delete and leave a team when they are its only member.' } }); return;
      }
      if (options.approveDuringWithdrawal && withdrawals === 1 && current) {
        const own = current.members.find(member => member.participantId === selfId); if (own) own.status = 'confirmed';
        await route.fulfill({ status: 409, json: { message: 'This join request was already approved. Refresh your team.' } }); return;
      }
      if (options.failWithdraw && withdrawals === 1) { await route.fulfill({ status: 409, json: { message: 'Request changed. Please retry.' } }); return; }
      current = null; await route.fulfill({ status: 204, body: '' }); return;
    } else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/participant/team');
  return { requests, withdrawals: () => withdrawals };
}

for (const noTeamResponse of ['empty', 'json-null'] as const) {
  test(`participants without a team can use Find Team with a ${noTeamResponse} response`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await setup(page, context, { noTeamResponse, open: [team('Available team', 1)] });
    await expect(page.getByRole('heading', { name: 'Find a Team', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Team', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Enter 8-character code')).toBeVisible();
    await expect(page.getByRole('article', { name: 'Available team', exact: true }).getByRole('button', { name: 'Join', exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

test('cards count confirmed members only and disable full teams', async ({ page, context }) => {
  await setup(page, context, { open: [team('Available team', 4, true), team('Full team', 5)] });
  const available = page.getByRole('article', { name: 'Available team', exact: true });
  await expect(available).toContainText('4 confirmed members');
  await expect(available).toContainText('1 spot left');
  await expect(available.getByRole('button', { name: 'Join', exact: true })).toBeEnabled();
  await expect(available).not.toContainText('PendingApplicant');
  const full = page.getByRole('article', { name: 'Full team', exact: true });
  await expect(full).toContainText('0 spots left');
  await expect(full.getByRole('button', { name: 'Full', exact: true })).toBeDisabled();
});

test('cards honor a smaller cohort team capacity', async ({ page, context }) => {
  await setup(page, context, { open: [team('Four-person cohort', 4, false, 4)] });
  await expect(page.getByRole('article', { name: 'Four-person cohort' }).getByRole('button', { name: 'Full', exact: true })).toBeDisabled();
});

test('a join request displays pending approval, not a joined-team dashboard, and can be withdrawn', async ({ page, context }) => {
  const state = await setup(page, context, { open: [team('Available team', 1)] });
  await page.getByRole('article').getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team request pending', exact: true })).toBeVisible();
  await expect(page.getByText('Request sent to Requested team. Waiting for team lead approval.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave Team', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Register team', exact: true })).toHaveCount(0);
  expect(state.requests.some(r => /\/(pending-members|eligibility)$/.test(r.path))).toBe(false);
  await page.getByRole('button', { name: 'Withdraw join request', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Withdraw request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Team', exact: true })).toBeVisible();
  expect(state.withdrawals()).toBe(1);
  expect(state.requests.some(r => r.method === 'DELETE' && r.path === '/api/teams/requested-team/join-request')).toBe(true);
});

test('pending request withdrawals retain state on failure and can be retried', async ({ page, context }) => {
  const state = await setup(page, context, { current: team('Pending team', 1, true), failWithdraw: true });
  await page.getByRole('button', { name: 'Withdraw join request', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Withdraw request', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Request changed. Please retry.');
  expect(state.withdrawals()).toBe(1);
  await expect(page.getByRole('heading', { name: 'Team request pending', exact: true, includeHidden: true })).toBeAttached();
  await page.getByRole('dialog').getByRole('button', { name: 'Withdraw request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Team', exact: true })).toBeVisible();
  expect(state.withdrawals()).toBe(2);
});

test('confirmed ordinary members retain the normal leave-team action', async ({ page, context }) => {
  const current = team('Confirmed team', 1, true);
  current.members[1].status = 'confirmed';
  const state = await setup(page, context, { current });
  await page.getByRole('button', { name: 'Leave Team', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave Team', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Team', exact: true })).toBeVisible();
  expect(state.withdrawals()).toBe(1);
});

function ownTeam(otherMembers = 0, pending = false) {
  const current = team('Accidental team', otherMembers + 1);
  current.members[0] = { ...current.members[0], participantId: selfId, participant: { ...self } };
  if (pending) current.members[1].status = 'pending';
  return current;
}

test('a sole lead confirms deletion and can then find and request another team', async ({ page, context }) => {
  const state = await setup(page, context, { current: ownTeam(), open: [team('Target team', 2)] });
  await page.getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('cancel outstanding invitations and archive its chat');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.withdrawals()).toBe(0);
  await page.getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find a Team', exact: true })).toBeVisible();
  expect(state.withdrawals()).toBe(1);
  expect(state.requests.some(r => r.method === 'DELETE' && r.path.endsWith(`/members/${selfId}`))).toBe(true);
  await page.getByRole('article', { name: 'Target team', exact: true }).getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team request pending', exact: true })).toBeVisible();
});

for (const pending of [false, true]) {
  test(`a lead cannot leave another ${pending ? 'pending' : 'confirmed'} member`, async ({ page, context }) => {
    const state = await setup(page, context, { current: ownTeam(1, pending) });
    await expect(page.getByText('Team leads can delete and leave only', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete team and leave', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Leave Team', exact: true })).toHaveCount(0);
    expect(state.withdrawals()).toBe(0);
  });
}

test('sole-lead deletion failures retain the confirmation and allow retry', async ({ page, context }) => {
  const state = await setup(page, context, { current: ownTeam(), failWithdraw: true });
  await page.getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Request changed. Please retry.');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find a Team', exact: true })).toBeVisible();
  expect(state.withdrawals()).toBe(2);
});

test('a stale confirmation refreshes the roster and prevents retry when a member arrives', async ({ page, context }) => {
  const state = await setup(page, context, { current: ownTeam(), memberArrivesOnLeave: true });
  await page.getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete team and leave', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('only member');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Delete team and leave', exact: true })).toBeDisabled();
  expect(state.withdrawals()).toBe(1);
});

test('a concurrent approval refreshes membership without deleting the newly confirmed member', async ({ page, context }) => {
  const state = await setup(page, context, { current: team('Approved team', 1, true), approveDuringWithdrawal: true });
  await page.getByRole('button', { name: 'Withdraw join request', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Withdraw request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leave Team', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team request pending', exact: true })).toHaveCount(0);
  expect(state.withdrawals()).toBe(1);
  expect(state.requests.filter(r => r.method === 'DELETE' && r.path.includes('/members/'))).toHaveLength(0);
});
