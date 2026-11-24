import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const id = '71b4a268-d167-49cb-9b94-760aacac3339', cohortId = 'self-profile-cohort';
const verticalA = '71b4a268-d167-49cb-9b94-760aacac3340', verticalB = '71b4a268-d167-49cb-9b94-760aacac3341';
const briefA = '71b4a268-d167-49cb-9b94-760aacac3342', briefB = '71b4a268-d167-49cb-9b94-760aacac3343';
async function setup(page: Page, context: BrowserContext, options: { failProfile?: boolean; failMatching?: boolean; staleProfile?: boolean; staleMatching?: boolean; pendingBuilder?: boolean; needsReview?: boolean } = {}) {
  let version = 1;
  const date = () => `2026-11-14T08:00:0${version}.000Z`;
  let participant = { preferredLanguage: "Python", otherLanguage: "", languageProficiency: "Intermediate", developmentExperience: !!options.pendingBuilder, testingExperience: !!options.pendingBuilder, deploymentExperience: !!options.pendingBuilder, builderConfirm: !(options.pendingBuilder || options.needsReview), id, participantId: 'SELF-001', email: 'signin@example.test', lmsEmail: 'learning@example.test', firstName: 'Protected', lastName: 'Learner', country: 'Ghana', city: 'Accra', phoneNumber: '+233200000001', whatsappNumber: '+233200000002', institution: 'Imported institution', educationLevel: 'Degree', fieldOfStudy: 'Medicine', gender: 'Female', pythonSkill: 'Intermediate', githubUsername: 'old-user', cohortId, cohort: { countries: ['GH', 'NG'] }, skills: ['Python'], interests: ['Education'], status: 'assigned', mustChangePassword: false, onboardingComplete: true, updatedAt: date(), learningCertificateIssued: true, learningCertificateId: 'LMS-CERT-001', learningHalfwayReached: true, learningFinishedAllLessons: true };
  let preference = { id: 'preference', participantId: id, updatedAt: date(), buildDeployAbility: 'confident', preferredRole: 'builder', firstChoiceSector: 'education', backupSector: 'health', teamStatus: 'full_team', crossCountryWilling: false, matchingProfileConsent: false, matchingProfileCompletedAt: '2026-11-10T08:00:00Z', briefRankings: [] as string[], availabilityNotes: '', verticalId1: null, verticalId2: null };
  const user = { ...participant, role: 'participant' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => { localStorage.setItem('auth_token', 'mock');localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'mock', portal: 'participant', isAuthenticated: true }, version: 0 })); }, user);
  await page.routeWebSocket(/socket\.io/, socket => socket.close());
  await page.route('**/*onesignal*', route => route.abort());
  const profileWrites: any[] = [], matchingWrites: any[] = [], builderWrites: any[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (request.method() === 'PATCH' && path.endsWith('/participants/me/builder-profile')) {
      const body = request.postDataJSON(); builderWrites.push(body); const { expectedUpdatedAt, ...changes } = body; version++; participant = { ...participant, ...changes, builderConfirm: true, updatedAt: date() }; data = participant;
    } else if (request.method() === 'PATCH' && path.endsWith('/participants/' + id)) {
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
  return { profileWrites, matchingWrites, builderWrites };
}

test('edits only allowed personal details and keeps identity, education, contact and certificate fields read-only', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const name of ['Name', 'First name', 'Last name', 'Age', 'Institution', 'Education level', 'Field of study', 'Gender', 'Phone', 'WhatsApp', 'Email', 'LMS email', 'Certificate ID', 'Learning certificate ID']) await expect(dialog.getByRole('textbox', { name, exact: true })).toHaveCount(0);
  await expect(dialog.getByText('LMS-CERT-001', { exact: true })).toBeVisible();
  await dialog.getByLabel('Country of residence', { exact: true }).selectOption('Nigeria');
  await dialog.getByLabel('City', { exact: true }).fill('Lagos');
  await dialog.getByLabel('GitHub username', { exact: true }).fill('corrected-user');
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.profileWrites).toEqual([{ expectedUpdatedAt: '2026-11-14T08:00:01.000Z', country: 'Nigeria', city: 'Lagos', githubUsername: 'corrected-user' }]);
  await page.reload();await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Lagos');
  await expect(dialog.getByText('signin@example.test', { exact: true })).toBeVisible();
});

test('saves all matching details, cohort verticals and ranked briefs without changing protected profile fields', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole('button', { name: 'Edit matching profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
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
  expect(state.matchingWrites).toEqual([{ expectedUpdatedAt: '2026-11-14T08:00:01.000Z', preferredRole: 'business_impact_lead', firstChoiceSector: 'finance', backupSector: 'legal', teamStatus: 'need_team', crossCountryWilling: true, matchingProfileConsent: true, verticalId1: verticalA, verticalId2: verticalB, availabilityNotes: 'Weekends', briefRankings: [briefA, briefB] }]);
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


test('existing builders must confirm their experience once and can choose Other with beginner proficiency', async ({ page, context }) => {
  const state = await setup(page, context, { pendingBuilder: true });
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Confirm your builder experience' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Close', exact: true })).toBeHidden();
  for (const name of ['Development experience', 'Testing experience', 'Deployment experience']) await expect(modal.getByLabel(name, { exact: true })).toHaveValue('yes');
  await modal.getByLabel('Preferred programming language', { exact: true }).selectOption('Other');
  await modal.getByLabel('Proficiency in your preferred language', { exact: true }).selectOption('Beginner');
  await modal.getByRole('button', { name: 'Confirm my experience' }).click();
  await expect(modal.getByRole('alert')).toContainText('Enter your preferred programming language');
  expect(state.builderWrites).toEqual([]);
  await modal.getByLabel('Other programming language').fill('Elixir');
  await modal.getByRole('button', { name: 'Confirm my experience' }).click();
  await expect(modal).toHaveCount(0);
  expect(state.builderWrites).toEqual([{ preferredLanguage: 'Other', otherLanguage: 'Elixir', languageProficiency: 'Beginner', developmentExperience: true, testingExperience: true, deploymentExperience: true, expectedUpdatedAt: '2026-11-14T08:00:01.000Z' }]);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Programming and builder experience' })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('participants can update their language and experience without changing protected profile fields', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole('button', { name: 'Edit builder experience' }).click(); const modal = page.getByRole('dialog');
  await modal.getByLabel('Preferred programming language', { exact: true }).selectOption('JavaScript');
  await modal.getByLabel('Proficiency in your preferred language', { exact: true }).selectOption('Beginner');
  for (const name of ['Development experience', 'Testing experience', 'Deployment experience']) await modal.getByLabel(name, { exact: true }).selectOption('yes');
  await modal.getByRole('button', { name: 'Confirm my experience' }).click(); await expect(modal).toHaveCount(0);
  expect(state.builderWrites).toHaveLength(1); expect(state.profileWrites).toEqual([]); expect(state.matchingWrites).toEqual([]);
  await expect(page.getByText('Qualified builder', { exact: true })).toBeVisible();
});


test('beginner and intermediate participants are asked all three questions even when they are not qualified builders', async ({ page, context }) => {
  const state = await setup(page, context, { needsReview: true }); const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Confirm your builder experience' })).toBeVisible();
  await modal.getByLabel('Preferred programming language', { exact: true }).selectOption('JavaScript');
  await modal.getByLabel('Proficiency in your preferred language', { exact: true }).selectOption('Beginner');
  await modal.getByLabel('Development experience', { exact: true }).selectOption('yes');
  await modal.getByLabel('Testing experience', { exact: true }).selectOption('yes');
  await modal.getByLabel('Deployment experience', { exact: true }).selectOption('yes');
  await modal.getByRole('button', { name: 'Confirm my experience' }).click(); await expect(modal).toHaveCount(0);
  expect(state.builderWrites[0]).toMatchObject({ languageProficiency: 'Beginner', developmentExperience: true, testingExperience: true, deploymentExperience: true });
  await expect(page.getByText('Qualified builder', { exact: true })).toBeVisible();
});


test('participants with no programming experience can confirm No without selecting a language, and the empty choice stays saved', async ({ page, context }) => {
  await setup(page, context, { needsReview: true }); const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Preferred programming language', { exact: true }).selectOption('');
  for (const name of ['Development experience', 'Testing experience', 'Deployment experience']) await modal.getByLabel(name, { exact: true }).selectOption('no');
  await modal.getByRole('button', { name: 'Confirm my experience' }).click(); await expect(modal).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('button', { name: 'Edit builder experience' })).toBeVisible(); await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit builder experience' }).click();
  await expect(modal.getByLabel('Preferred programming language', { exact: true })).toHaveValue('');
  await expect(modal.getByLabel('Proficiency in your preferred language', { exact: true })).toHaveValue('');
});
