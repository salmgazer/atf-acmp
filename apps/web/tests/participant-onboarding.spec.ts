import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const participant = { id: 'matching-onboarding-user', participantId: 'LMS-001', email: 'portal@example.test', lmsEmail: 'learning@example.test', firstName: 'Imported', lastName: 'Learner', country: 'GH', city: 'Accra', institution: 'Example institution', locationType: 'Urban', gender: 'Female', educationLevel: "Bachelor's", currentAffiliation: 'Graduate', fieldOfStudy: 'Education', pythonSkill: 'Intermediate', gitSkill: 'Basic', aiExperience: 'Self-taught', githubUsername: 'imported-user', whatsappNumber: '+233200000002', phoneNumber: '+233200000001', cohortId: 'matching-cohort', cohort: { countries: ['GH', 'NG'] }, group: 'Batch 1', skills: [], interests: [], mustChangePassword: false, onboardingComplete: false, status: 'active', learningCertificateIssued: false, learningFinishedAllLessons: false, learningHalfwayReached: true };
async function setup(page: Page, context: BrowserContext, options: { failSubmit?: boolean; completed?: boolean; failPreference?: boolean } = {}) {
  const user = { ...participant, onboardingComplete: options.completed || false, role: 'participant' };
  await context.addCookies([{ name: 'auth_token', value: 'present', url: 'http://localhost:63781' }, { name: 'auth_portal', value: 'participant', url: 'http://localhost:63781' }]);
  await page.addInitScript(user => { localStorage.setItem('auth_token', 'test-token'); localStorage.setItem('acmp-auth-store', JSON.stringify({ state: { user, token: 'test-token', portal: 'participant', isAuthenticated: true }, version: 0 })); }, user);
  const submissions: any[] = []; let complete = options.completed || false; let consent = true; let crossCountryWilling = false; let preferenceAttempts = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/participants/matching-onboarding-user/onboarding')) {
      submissions.push(route.request().postDataJSON());
      if (options.failSubmit && submissions.length === 1) { await route.fulfill({ status: 400, json: { message: 'Please review your programme verticals' } }); return; }
      complete = true; data = { ...participant, onboardingComplete: true, preference: submissions.at(-1).preferences };
    } else if (path.endsWith('/cross-country-preference')) {
      preferenceAttempts++;
      if (options.failPreference && preferenceAttempts === 1) { await route.fulfill({ status: 503, json: { message: 'Please try again shortly' } }); return; }
      crossCountryWilling = route.request().postDataJSON().crossCountryWilling;
      data = { matchingProfileConsent: consent, matchingProfileCompletedAt: '2026-11-07T12:00:00Z', buildDeployAbility: 'confident', firstChoiceSector: 'education', backupSector: 'health', teamStatus: 'need_team', preferredRole: 'builder', crossCountryWilling };
    } else if (path.endsWith('/matching-consent')) {
      consent = route.request().postDataJSON().consent;
      data = { ...participant, ...{ matchingProfileConsent: consent, matchingProfileCompletedAt: '2026-11-07T12:00:00Z', buildDeployAbility: 'confident', firstChoiceSector: 'education', backupSector: 'health', teamStatus: 'need_team', preferredRole: 'builder', crossCountryWilling } };
    } else if (path.endsWith('/preferences')) data = { matchingProfileConsent: consent, matchingProfileCompletedAt: '2026-11-07T12:00:00Z', buildDeployAbility: 'confident', firstChoiceSector: 'education', backupSector: 'health', teamStatus: 'need_team', preferredRole: 'builder', crossCountryWilling };
    else if (path.endsWith('/participants/me')) data = { ...participant, onboardingComplete: complete };
    else if (path.endsWith('/auth/me')) data = { ...user, onboardingComplete: complete };
    else if (path.includes('/teams/my/')) data = null;
    else if (path.endsWith('/cohorts/matching-cohort')) data = { id: 'matching-cohort', status: 'active', countries: ['GH', 'NG'], deadlines: {} };
    else if (path.endsWith('/unread-count')) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto(options.completed ? '/participant/profile' : '/participant/onboarding');
  if (!options.completed) await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
  return submissions;
}
async function sectorsAndPreferences(page: Page, consent = 'No') {
  await page.getByLabel('First-choice sector').selectOption('education');
  await page.getByLabel('Backup sector').selectOption('health');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: 'Sector specialist', exact: true }).check();
  await page.getByRole('radio', { name: 'Part of a team', exact: true }).check();
  await page.getByRole('radiogroup', { name: 'Open to a cross-country team?', exact: true }).getByRole('radio', { name: 'No', exact: true }).check();
  await page.getByRole('radiogroup', { name: 'Show your matching profile to other participants?', exact: true }).getByRole('radio', { name: consent, exact: true }).check();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
}

test('prefills imported fields, keeps learning records read-only and submits explicit No answers with confirmed corrections', async ({ page, context }) => {
  const submissions = await setup(page, context);
  await expect(page.getByLabel('First name')).toHaveValue('Imported');
  await expect(page.getByLabel('Country of residence')).toHaveValue('Ghana');
  await expect(page.getByLabel('WhatsApp number')).toHaveValue('+233200000002');
  await expect(page.getByLabel('Field of study')).toHaveValue('Education');
  for (const name of ['First name', 'Last name', 'Institution', 'Phone number', 'WhatsApp number', 'Gender', 'Education level', 'Field of study']) await expect(page.getByLabel(name, { exact: false })).toHaveJSProperty('readOnly', true);
  await expect(page.getByText('learning@example.test', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Learning certificate ID' })).toHaveCount(0);
  await page.getByLabel('City', { exact: true }).fill('Kumasi');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Python skill', { exact: true })).toHaveValue('Intermediate');
  await expect(page.getByLabel('GitHub username', { exact: false })).toHaveValue('imported-user');
  await page.getByRole('radio', { name: 'With support', exact: true }).check();
  await page.getByLabel('GitHub username').fill('confirmed-user');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await sectorsAndPreferences(page);
  await expect(page.getByRole('heading', { name: 'Review Your Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Setup', exact: true }).click();
  await expect(page).toHaveURL(/\/participant\/dashboard$/);
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ profile: { city: 'Kumasi', country: 'Ghana', githubUsername: 'confirmed-user', githubAccountStatus: 'has_account' }, skills: { skills: [], interests: [] }, preferences: { firstChoiceSector: 'education', backupSector: 'health', buildDeployAbility: 'with_support', teamStatus: 'partial_team', preferredRole: 'sector_specialist', crossCountryWilling: false, matchingProfileConsent: false } });
  expect(submissions[0].profile).not.toHaveProperty('learningCertificateIssued');
  expect(await page.evaluate(() => sessionStorage.getItem('acmp-onboarding-v2:matching-onboarding-user'))).toBeNull();
});

test('requires explicit answers, supports no GitHub account and retains drafts through back navigation and reload', async ({ page, context }) => {
  await setup(page, context);
  await page.getByLabel('City', { exact: true }).fill('Saved city');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('p[role=alert]')).toContainText('build and deploy');
  await page.getByRole('radio', { name: 'No', exact: true }).check();
  await page.getByRole('radio', { name: 'I do not have an account yet', exact: true }).check();
  await expect(page.getByRole('link', { name: 'Create a GitHub account' })).toHaveAttribute('href', 'https://github.com/signup');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Skills & GitHub' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'I do not have an account yet', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('Saved city');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('First-choice sector').selectOption('education');
  await expect(page.getByLabel('Backup sector').locator('option[value="education"]')).toBeDisabled();
  await page.getByLabel('Backup sector').selectOption('health');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Open to a cross-country team?', exact: true }).getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Show your matching profile to other participants?', exact: true }).getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.locator('p[role=alert]')).toContainText('Answer each team preference');
});

test('rejects imported non-username GitHub text and keeps all answers after a failed submission', async ({ page, context }) => {
  const submissions = await setup(page, context, { failSubmit: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: 'Yes, confidently', exact: true }).check();
  await page.getByLabel('GitHub username').fill('Please contact me');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('p[role=alert]')).toContainText('valid GitHub username');
  await page.getByRole('radio', { name: 'I do not have an account yet', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await sectorsAndPreferences(page, 'Yes');
  await page.getByRole('button', { name: 'Complete Setup', exact: true }).click();
  await expect(page.locator('p[role=alert]')).toContainText('Your answers have been kept');
  await expect(page.getByRole('heading', { name: 'Review Your Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Setup', exact: true }).click();
  await expect(page).toHaveURL(/\/participant\/dashboard$/);
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toEqual(submissions[0]);
  expect(submissions[1].profile.githubUsername).toBeUndefined();
});


test('participants can withdraw and restore matching visibility on their own profile', async ({ page, context }) => {
  await setup(page, context, { completed: true });
  const hidden = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/matching-consent'));
  await page.getByRole('button', { name: 'Hide my matching profile', exact: true }).click();
  expect((await hidden).postDataJSON()).toEqual({ consent: false });
  await expect(page.getByRole('button', { name: 'Show my matching profile', exact: true })).toBeVisible();
  const visible = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/matching-consent'));
  await page.getByRole('button', { name: 'Show my matching profile', exact: true }).click();
  expect((await visible).postDataJSON()).toEqual({ consent: true });
  await expect(page.getByRole('button', { name: 'Hide my matching profile', exact: true })).toBeVisible();
});


test('returning participants can open the new matching questions from their profile without a password reset', async ({ page, context }) => {
  await setup(page, context, { completed: true });
  await page.route('**/participants/matching-onboarding-user/preferences', route => route.fulfill({ json: null }));
  await page.reload();
  await page.getByRole('link', { name: 'Complete my matching profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure Your Account' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Skills & GitHub' })).toBeVisible();
});


test('participants can save cross-country preferences in both directions and retain them after reload without changing visibility', async ({ page, context }) => {
  await setup(page, context, { completed: true });
  const selector = page.getByLabel('Open to a cross-country team?', { exact: true });
  const save = page.getByRole('button', { name: 'Save cross-country preference', exact: true });
  await expect(selector).toHaveValue('no');
  await expect(save).toBeDisabled();
  await selector.selectOption('yes');
  let request = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/cross-country-preference'));
  await save.click();
  expect((await request).postDataJSON()).toEqual({ crossCountryWilling: true });
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(selector).toHaveValue('yes');
  await selector.selectOption('no');
  request = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/cross-country-preference'));
  await save.click();
  expect((await request).postDataJSON()).toEqual({ crossCountryWilling: false });
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(selector).toHaveValue('no');
  await expect(page.getByRole('button', { name: 'Hide my matching profile', exact: true })).toBeVisible();
});

test('keeps an unsaved cross-country answer after a failed save and supports retry', async ({ page, context }) => {
  await setup(page, context, { completed: true, failPreference: true });
  const selector = page.getByLabel('Open to a cross-country team?', { exact: true });
  const save = page.getByRole('button', { name: 'Save cross-country preference', exact: true });
  await selector.selectOption('yes');
  await save.click();
  await expect(page.locator('p[role=alert]')).toContainText('Please try again shortly');
  await expect(selector).toHaveValue('yes');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  await expect(page.locator('p[role=alert]')).toHaveCount(0);
  await page.reload();
  await expect(selector).toHaveValue('yes');
});
