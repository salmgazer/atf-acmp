import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const id = '71b4a268-d167-49cb-9b94-760aacac3339', cohortId = 'self-profile-cohort';
const verticalA = '71b4a268-d167-49cb-9b94-760aacac3340', verticalB = '71b4a268-d167-49cb-9b94-760aacac3341';
const briefA = '71b4a268-d167-49cb-9b94-760aacac3342', briefB = '71b4a268-d167-49cb-9b94-760aacac3343';
async function setup(page: Page, context: BrowserContext, options: { failProfile?: boolean; failMatching?: boolean; staleProfile?: boolean; staleMatching?: boolean } = {}) {
  let version = 1;
  const date = () => `2026-11-14T08:00:0${version}.000Z`;
  let participant = { id, participantId: 'SELF-001', email: 'signin@example.test', lmsEmail: 'learning@example.test', firstName: 'Protected', lastName: 'Learner', country: 'Ghana', city: 'Accra', phoneNumber: '+233200000001', whatsappNumber: '+233200000002', institution: 'Imported institution', educationLevel: 'Degree', fieldOfStudy: 'Medicine', gender: 'Female', pythonSkill: 'Intermediate', githubUsername: 'old-user', cohortId, cohort: { countries: ['GH', 'NG'] }, skills: ['Python'], interests: ['Education'], status: 'assigned', mustChangePassword: false, onboardingComplete: true, updatedAt: date(), learningCertificateIssued: true, learningCertificateId: 'LMS-CERT-001', learningHalfwayReached: true, learningFinishedAllLessons: true };
  let preference = { id: 'preference', participantId: id, updatedAt: date(), buildDeployAbility: 'confident', preferredRole: 'builder', firstChoiceSector: 'education', backupSector: 'health', teamStatus: 'full_team', crossCountryWilling: false, matchingProfileConsent: false, matchingProfileCompletedAt: '2026-11-10T08:00:00Z', briefRankings: [] as string[], availabilityNotes: '', verticalId1: null, verticalId2: null };
  const user = { ...participant, role: 'participant' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => { localStorage.setItem('auth_token', 'mock');localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'mock', portal: 'participant', isAuthenticated: true }, version: 0 })); }, user);
  await page.routeWebSocket(/socket\.io/, socket => socket.close());
  await page.route('**/*onesignal*', route => route.abort());
  const profileWrites: any[] = [], matchingWrites: any[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (request.method() === 'PATCH' && path.endsWith('/participants/' + id)) {
      const body = request.postDataJSON();profileWrites.push(body);
      if (options.staleProfile && profileWrites.length === 1) { version++; participant = { ...participant, city: 'Staff-corrected city', updatedAt: date() }; await route.fulfill({ status: 409, json: { message: 'Your profile changed. Reload the latest profile and review your edits.' } });return; }
      if (options.failProfile && profileWrites.length === 1) { await route.fulfill({ status: 503, json: { message: 'Please retry the profile save' } });return; }
      const { expectedUpdatedAt, ...changes } = body; version++;participant = { ...participant, ...changes, updatedAt: date() };data = participant;
    } else if (request.method() === 'PATCH' && path.endsWith('/matching-profile')) {
      const body = request.postDataJSON();matchingWrites.push(body);
      if (options.staleMatching && matchingWrites.length === 1) { version++;preference = { ...preference, availabilityNotes: 'Staff session hours', updatedAt: date() };await route.fulfill({ status: 409, json: { message: 'Your matching profile changed. Reload the latest answers and review your edits.' } });return; }
      if (options.failMatching && matchingWrites.length === 1) { await route.fulfill({ status: 503, json: { message: 'Please retry the matching save' } });return; }
      const { expectedUpdatedAt, ...changes } = body;version++;preference = { ...preference, ...changes, updatedAt: date() };data = preference;
    } else if (path.endsWith('/participants/me')) data = participant;
    else if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/preferences')) data = preference;
    else if (path.includes('/teams/my/')) data = null;
    else if (path.includes('/briefs/verticals/')) data = [{ id: verticalA, name: 'Health', isActive: true }, { id: verticalB, name: 'Finance', isActive: true }];
    else if (path.includes('/briefs/approved')) data = [{ id: briefA, title: 'Health brief', cohortId, status: 'approved' }, { id: briefB, title: 'Finance brief', cohortId, status: 'approved' }];
    else if (path.endsWith('/cohorts/' + cohortId)) data = { id: cohortId, status: 'active', countries: ['GH', 'NG'], deadlines: {} };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/participant/profile');
  return { profileWrites, matchingWrites };
}

test('edits only allowed personal details and keeps identity, education, contact and certificate fields read-only', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const name of ['Name', 'First name', 'Last name', 'Age', 'Institution', 'Education level', 'Field of study', 'Gender', 'Phone', 'WhatsApp', 'Email', 'LMS email', 'Certificate ID', 'Learning certificate ID']) await expect(dialog.getByRole('textbox', { name, exact: true })).toHaveCount(0);
  await expect(dialog.getByText('LMS-CERT-001', { exact: true })).toBeVisible();
  await dialog.getByLabel('Country of residence', { exact: true }).selectOption('Nigeria');
  await dialog.getByLabel('City', { exact: true }).fill('Lagos');
  await dialog.getByLabel('Python skill', { exact: true }).fill('Advanced');
  await dialog.getByLabel('GitHub username', { exact: true }).fill('corrected-user');
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.profileWrites).toEqual([{ expectedUpdatedAt: '2026-11-14T08:00:01.000Z', country: 'Nigeria', city: 'Lagos', pythonSkill: 'Advanced', githubUsername: 'corrected-user' }]);
  await page.reload();await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Lagos');
  await expect(dialog.getByText('signin@example.test', { exact: true })).toBeVisible();
});

test('saves all matching details, cohort verticals and ranked briefs without changing protected profile fields', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole('button', { name: 'Edit matching profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Can you build and deploy an application?', { exact: true }).selectOption('with_support');
  await dialog.getByLabel('Preferred team role', { exact: true }).selectOption('business_impact_lead');
  await dialog.getByLabel('First-choice sector', { exact: true }).selectOption('finance');
  await dialog.getByLabel('Backup sector', { exact: true }).selectOption('legal');
  await dialog.getByLabel('Team status', { exact: true }).selectOption('need_team');
  await dialog.getByLabel('Open to a cross-country team?', { exact: true }).selectOption('yes');
  await dialog.getByLabel('Show your matching profile to other participants?', { exact: true }).selectOption('yes');
  await dialog.getByLabel('Programme vertical 1', { exact: true }).selectOption(verticalA);
  await dialog.getByLabel('Programme vertical 2', { exact: true }).selectOption(verticalB);
  await dialog.getByLabel('Availability notes', { exact: true }).fill('Weekends');
  await dialog.getByLabel('Brief choice 1', { exact: true }).selectOption(briefA);
  await dialog.getByLabel('Brief choice 2', { exact: true }).selectOption(briefB);
  await dialog.getByRole('button', { name: 'Save matching profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.matchingWrites).toEqual([{ expectedUpdatedAt: '2026-11-14T08:00:01.000Z', buildDeployAbility: 'with_support', preferredRole: 'business_impact_lead', firstChoiceSector: 'finance', backupSector: 'legal', teamStatus: 'need_team', crossCountryWilling: true, matchingProfileConsent: true, verticalId1: verticalA, verticalId2: verticalB, availabilityNotes: 'Weekends', briefRankings: [briefA, briefB] }]);
  expect(state.profileWrites).toEqual([]);
  await page.reload();await page.getByRole('button', { name: 'Edit matching profile', exact: true }).click();
  await expect(dialog.getByLabel('Availability notes', { exact: true })).toHaveValue('Weekends');
  await expect(dialog.getByLabel('Preferred team role', { exact: true })).toHaveValue('business_impact_lead');
});

for (const kind of ['profile', 'matching'] as const) {
  test(`${kind} keeps drafts after a failed save and supports retry`, async ({ page, context }) => {
    const state = await setup(page, context, kind === 'profile' ? { failProfile: true } : { failMatching: true });
    await page.getByRole('button', { name: kind === 'profile' ? 'Edit profile' : 'Edit matching profile', exact: true }).click();
    const dialog = page.getByRole('dialog'), field = dialog.getByLabel(kind === 'profile' ? 'City' : 'Availability notes', { exact: true });
    await field.fill('Kept draft');
    await dialog.getByRole('button', { name: kind === 'profile' ? 'Save profile' : 'Save matching profile', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Please retry');
    await expect(field).toHaveValue('Kept draft');
    await dialog.getByRole('button', { name: kind === 'profile' ? 'Save profile' : 'Save matching profile', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const writes = kind === 'profile' ? state.profileWrites : state.matchingWrites;
    expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);
  });
  test(`${kind} can reload stale data and save against the refreshed version`, async ({ page, context }) => {
    const state = await setup(page, context, kind === 'profile' ? { staleProfile: true } : { staleMatching: true });
    const editName = kind === 'profile' ? 'Edit profile' : 'Edit matching profile', saveName = kind === 'profile' ? 'Save profile' : 'Save matching profile';
    await page.getByRole('button', { name: editName, exact: true }).click();
    const dialog = page.getByRole('dialog'), field = dialog.getByLabel(kind === 'profile' ? 'City' : 'Availability notes', { exact: true });
    await field.fill('Outdated draft');await dialog.getByRole('button', { name: saveName, exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('changed');
    await dialog.getByRole('button', { name: kind === 'profile' ? 'Reload latest profile' : 'Reload latest answers', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: editName, exact: true }).click();
    await expect(field).toHaveValue(kind === 'profile' ? 'Staff-corrected city' : 'Staff session hours');
    await field.fill('Reviewed edit');await dialog.getByRole('button', { name: saveName, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const writes = kind === 'profile' ? state.profileWrites : state.matchingWrites;
    expect(writes[1].expectedUpdatedAt).toBe('2026-11-14T08:00:02.000Z');
  });
}

test('cancelling either editor sends no changes', async ({ page, context }) => {
  const state = await setup(page, context);
  for (const [name, field] of [['Edit profile', 'City'], ['Edit matching profile', 'Availability notes']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('dialog').getByLabel(field, { exact: true }).fill('Discarded');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(state.profileWrites).toEqual([]);expect(state.matchingWrites).toEqual([]);
});
