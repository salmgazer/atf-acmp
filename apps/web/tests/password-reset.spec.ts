import { test, expect } from '@playwright/test';

for (const portal of ['participant', 'staff']) {
  test(`${portal} reset request shows confirmation only after a successful API response`, async ({ page }) => {
    const requests: unknown[] = [];
    await page.route('**/api/auth/forgot-password', async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { message: 'If an account exists, a reset link will be sent.' } });
    });
    await page.goto(`/${portal}/forgot-password`);
    await page.getByLabel('Email address', { exact: true }).fill('LEARNER@EXAMPLE.TEST');
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toBeVisible();
    expect(requests).toEqual([{ email: 'learner@example.test', portal }]);
    await expect(page.getByText('If your account is registered, a reset link will be emailed to you', { exact: true })).toBeVisible();
  });

  for (const status of [429, 503]) {
    test(`${portal} keeps the request form usable after ${status} instead of claiming an email was sent`, async ({ page }) => {
      let attempts = 0;
      await page.route('**/api/auth/forgot-password', async route => {
        attempts++;
        if (attempts === 1) {
          await route.fulfill({ status, json: { statusCode: status, message: status === 429 ? 'Too many requests' : 'Password reset is temporarily unavailable. Please try again later.', retryAfterSeconds: 60 } });
        } else await route.fulfill({ json: { message: 'If an account exists, a reset link will be sent.' } });
      });
      await page.goto(`/${portal}/forgot-password`);
      await page.getByLabel('Email address', { exact: true }).fill('learner@example.test');
      await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
      await expect(page.locator('form [role=alert]')).toContainText(status === 429 ? '60 seconds' : 'temporarily unavailable');
      await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('learner@example.test');
      await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toBeVisible();
    });
  }
}

test('a network failure preserves the participant request form and does not show email confirmation', async ({ page }) => {
  await page.route('**/api/auth/forgot-password', route => route.abort('failed'));
  await page.goto('/participant/forgot-password');
  await page.getByLabel('Email address', { exact: true }).fill('learner@example.test');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.locator('form [role=alert]')).toContainText('Network error');
  await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toHaveCount(0);
});

test('an expired reset token displays the reset error without attempting session renewal or redirecting away', async ({ page }) => {
  const refreshes: string[] = [];
  await page.route('**/api/auth/refresh', async route => { refreshes.push(route.request().url()); await route.fulfill({ status: 401, json: { message: 'Not signed in' } }); });
  await page.route('**/api/auth/reset-password', route => route.fulfill({ status: 401, json: { message: 'Invalid or expired password reset token' } }));
  await page.goto('/participant/reset-password?token=expired-test-token');
  await page.getByLabel('New password', { exact: true }).fill('New-password-123!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('New-password-123!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Invalid or expired password reset token', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/participant\/reset-password\?token=expired-test-token$/);
  expect(refreshes).toEqual([]);
});
