import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const id = 'reason-lead', targetId = 'reason-target', teamId = 'reason-team', cohortId = 'reason-cohort';
const date = '2026-11-17T08:00:00Z';
const self = { id, participantId: 'SYNTHETIC-LEAD', email: 'lead@example.test', firstName: 'Example', lastName: 'Lead', role: 'participant', cohortId, country: 'Ghana', status: 'assigned', onboardingComplete: true, mustChangePassword: false, skills: [], interests: [] };
const note = 'No contributions after repeated contact.\nPlease review <script>window.noteExecuted = true</script> as plain text.';
async function setup(page: Page, context: BrowserContext, options: { staff?: boolean; role?: string; failFirst?: boolean; legacy?: boolean } = {}) {
  const portal = options.staff ? 'staff' : 'participant';
  const user = { ...self, role: options.staff ? 'program_manager' : 'participant' };
  const target = { ...self, id: targetId, firstName: 'Target', lastName: 'Member' };
  const team = { id: teamId, name: 'Reason review team', cohortId, cohort: { id: cohortId, name: 'Reason cohort', status: 'active', teamSizeMax: 5 }, status: 'forming', inviteCode: 'REASON12', createdAt: date, members: [
    { id: 'self-membership', teamId, participantId: id, role: options.role || 'lead', status: 'confirmed', joinedAt: date, participant: self },
    { id: 'target-membership', teamId, participantId: targetId, role: 'member', status: 'confirmed', joinedAt: date, participant: target },
  ] };
  const request = { id: 'removal-request', teamId, team, participantId: targetId, participant: target, requestedBy: id, requester: self, status: 'pending', reason: options.legacy ? null : note, requestedAt: date };
  const writes: Record<string, unknown>[] = [];
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: portal, url: 'http://localhost:63781' }]);
  await page.addInitScript(({ user, portal, cohortId }) => {
    localStorage.setItem('auth_token', 'synthetic');
    localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'synthetic', portal, isAuthenticated: true }, version: 0 }));
    localStorage.setItem('acmp-staff-cohort-store', JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, portal, cohortId });
  await page.routeWebSocket(/socket\.io/, socket => socket.close());
  await page.route('**/*onesignal*', route => route.abort());
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let data: unknown = [];
    if (req.method() === 'POST' && path.endsWith(`/teams/${teamId}/removal-requests`)) {
      const body = req.postDataJSON(); writes.push(body);
      if (options.failFirst && writes.length === 1) { await route.fulfill({ status: 503, json: { message: 'Could not save the request. Please retry.' } }); return; }
      data = { immediate: false, request: { ...request, reason: body.reason } };
    } else if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/participants/me')) data = self;
    else if (path.endsWith(`/teams/my/${id}`)) data = team;
    else if (path.endsWith('/teams/admin/removal-requests')) data = [request];
    else if (path.endsWith('/cohorts')) data = { data: [{ id: cohortId, name: 'Reason cohort' }], total: 1 };
    else if (path.endsWith(`/cohorts/${cohortId}`)) data = team.cohort;
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto(options.staff ? '/staff/teams/removal-requests' : '/participant/team');
  return { writes };
}

for (const role of ['lead', 'co_lead']) {
  test(`${role} must supply a note before requesting removal; the member remains until staff approval`, async ({ page, context }) => {
    const { writes } = await setup(page, context, { role });
    await page.getByRole('button', { name: 'Request removal of Target Member', exact: true }).click();
    const dialog = page.getByRole('dialog'), submit = dialog.getByRole('button', { name: 'Submit removal request', exact: true });
    await expect(dialog).toContainText('The member stays on the team until staff approve.');
    await expect(submit).toBeDisabled();
    const field = dialog.getByLabel('Reason for removal (required)', { exact: true });
    await expect(field).toHaveAttribute('maxlength', '500');
    await field.fill(' \n\t '); await expect(submit).toBeDisabled();
    await field.fill('Draft only'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(writes).toHaveLength(0);
    await page.getByRole('button', { name: 'Request removal of Target Member', exact: true }).click();
    await expect(field).toHaveValue('');
    await field.fill(`  ${note}\n  `); await submit.click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([{ participantId: targetId, requestedBy: id, reason: note }]);
    await expect(page.getByText('Target Member', { exact: true })).toBeVisible();
    await expect(page.getByText('Removal request sent to staff for approval', { exact: true })).toBeVisible();
  });
}

test('a failed removal submission retains the note and can be retried', async ({ page, context }) => {
  const { writes } = await setup(page, context, { failFirst: true });
  await page.getByRole('button', { name: 'Request removal of Target Member', exact: true }).click();
  const dialog = page.getByRole('dialog'), field = dialog.getByLabel('Reason for removal (required)', { exact: true });
  await field.fill(note); await dialog.getByRole('button', { name: 'Submit removal request', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Please retry');
  await expect(field).toHaveValue(note);
  await dialog.getByRole('button', { name: 'Submit removal request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
});

test('ordinary members do not gain removal-request controls', async ({ page, context }) => {
  await setup(page, context, { role: 'member' });
  await expect(page.getByRole('heading', { name: 'Team Members', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request removal of Target Member', exact: true })).toHaveCount(0);
});

test('staff can read the note on the request and both decision dialogs, with markup displayed as plain text', async ({ page, context }) => {
  await setup(page, context, { staff: true });
  const reason = page.getByText(note, { exact: true });
  await expect(reason).toBeVisible(); await expect(reason).toHaveCSS('white-space', 'pre-wrap');
  for (const action of ['Approve', 'Reject']) {
    await page.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(note, { exact: true })).toBeVisible();
    await expect(dialog.locator('script')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(await page.evaluate(() => (window as unknown as { noteExecuted?: boolean }).noteExecuted)).toBeUndefined();
});

test('legacy requests without notes remain reviewable and clearly indicate the missing reason', async ({ page, context }) => {
  await setup(page, context, { staff: true, legacy: true });
  await expect(page.getByText('No reason provided for this earlier request.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('No reason provided for this earlier request.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Approve Removal', exact: true })).toBeEnabled();
});
