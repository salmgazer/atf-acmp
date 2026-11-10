import { test, expect } from "@playwright/test";

test("login shows a retry countdown, keeps entries, and does not resend automatically", async ({ page }) => {
  await page.clock.install();
  let attempts = 0;
  await page.route("**/api/**", route => {
    if (new URL(route.request().url()).pathname.endsWith("/auth/login")) {
      attempts++;
      return route.fulfill({ status: 429, headers: { "Retry-After": "3" }, json: { statusCode: 429, message: "ThrottlerException: Too Many Requests", retryAfterSeconds: 3 } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/participant/login");
  await page.getByLabel("Email address").fill("participant@example.test");
  await page.getByPlaceholder("Enter your password").fill("Initial-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Too many requests" })).toContainText("Try again in 3 seconds");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Email address")).toHaveValue("participant@example.test");
  await expect(page.getByPlaceholder("Enter your password")).toHaveValue("Initial-password-123");
  await page.clock.fastForward(3100);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  expect(attempts).toBe(1);
});
