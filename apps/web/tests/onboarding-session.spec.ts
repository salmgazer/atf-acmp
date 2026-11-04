import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const participant = { id: "onboarding-user", participantId: "ATF-ONBOARD-001", email: "onboarding@example.test", firstName: "Test", lastName: "Participant", country: "GH", cohortId: "onboarding-cohort", skills: [], interests: [], mustChangePassword: true, onboardingComplete: false, status: "active", createdAt: "2026-11-01T00:00:00Z" };

async function setup(context: BrowserContext, page: Page, options: { holdPassword?: boolean; wrongPassword?: boolean } = {}) {
  const user = { ...participant, role: "participant" };
  let changed = false, rotating = false, completed = false, refreshRequests = 0;
  let finishPassword!: () => void, sawPassword!: () => void, sawStale!: () => void;
  const blockedPassword = new Promise<void>(resolve => { finishPassword = resolve; });
  const passwordStarted = new Promise<void>(resolve => { sawPassword = resolve; });
  const staleRequest = new Promise<void>(resolve => { sawStale = resolve; });
  const profileHeaders: string[] = [];
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "participant", url: "http://localhost:63781" }]);
  await page.addInitScript(user => {
    localStorage.setItem("auth_token", "old-access-token");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "old-access-token", portal: "participant", isAuthenticated: true }, version: 0 }));
  }, user);
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const authorization = route.request().headers().authorization || "";
    const current = { ...participant, mustChangePassword: !changed, onboardingComplete: completed, status: completed ? "ready" : "active" };
    if (path.endsWith("/auth/change-password")) {
      rotating = true; sawPassword();
      if (options.wrongPassword) {
        rotating = false;
        await route.fulfill({ status: 401, json: { message: "Current password is incorrect" } }); return;
      }
      if (options.holdPassword) await blockedPassword;
      changed = true;
      await route.fulfill({ json: { message: "Password changed successfully", accessToken: "new-access-token", refreshToken: "", expiresIn: 3600, user: { ...user, mustChangePassword: false } } }); return;
    }
    if (path.endsWith("/auth/refresh")) { refreshRequests++; await route.fulfill({ status: 401, json: { message: "Old session revoked" } }); return; }
    if (path.endsWith("/participants/me")) {
      profileHeaders.push(authorization);
      if ((changed || rotating) && authorization !== "Bearer new-access-token") {
        await route.fulfill({ status: 401, json: { message: "Session has ended" } }); sawStale(); return;
      }
      await route.fulfill({ json: current }); return;
    }
    if (path.endsWith("/participants/onboarding-user/onboarding")) {
      expect(authorization).toBe("Bearer new-access-token");
      expect(route.request().postDataJSON()).toMatchObject({ profile: { firstName: "Test", lastName: "Participant" }, skills: { skills: ["Python"], interests: ["Education"] } });
      completed = true;
      await route.fulfill({ json: { ...current, onboardingComplete: true, status: "ready" } }); return;
    }
    let data: unknown = [];
    if (path.endsWith("/auth/me")) data = { ...user, mustChangePassword: !changed, onboardingComplete: completed };
    else if (path.includes("/teams/my/")) data = null;
    else if (path.endsWith("/cohorts/onboarding-cohort")) data = { id: "onboarding-cohort", name: "Test cohort", status: "active", deadlines: {} };
    else if (path.endsWith("/unread-count")) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  return { passwordStarted, staleRequest, finishPassword, profileHeaders, refreshRequests: () => refreshRequests };
}

async function submitPassword(page: Page) {
  await page.getByPlaceholder("Create a strong password").fill("New-password-456!");
  await page.getByPlaceholder("Confirm your new password").fill("New-password-456!");
  await page.getByRole("button", { name: "Change Password & Continue" }).click();
}

test("password change keeps participants signed in through complete onboarding", async ({ context, page }) => {
  const state = await setup(context, page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/participant/onboarding");
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "Personal Information" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("auth_token"))).toBe("new-access-token");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Skills & Interests" })).toBeVisible();
  await page.getByText("Python", { exact: true }).click();
  await page.getByText("Education", { exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preferred Verticals" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review Your Profile" })).toBeVisible();
  await page.getByRole("button", { name: "Complete Setup", exact: true }).click();
  await expect(page).toHaveURL(/\/participant\/dashboard$/);
  expect(state.profileHeaders).toContain("Bearer new-access-token");
  expect(state.refreshRequests()).toBe(0);
  expect(errors).toEqual([]);
});

test("background requests wait for password session rotation before retrying", async ({ context, page }) => {
  const state = await setup(context, page, { holdPassword: true });
  await page.goto("/participant/onboarding");
  await submitPassword(page);
  await state.passwordStarted;
  // Make the mounted query stale without advancing the pending HTTP request's timeout.
  await page.clock.setFixedTime(new Date(Date.now() + 60000));
  await page.evaluate(() => { window.dispatchEvent(new Event("offline")); window.dispatchEvent(new Event("online")); });
  await state.staleRequest;
  state.finishPassword();
  await expect(page.getByRole("heading", { name: "Personal Information" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("auth_token"))).toBe("new-access-token");
  expect(state.refreshRequests()).toBe(0);
  expect(state.profileHeaders).toContain("Bearer new-access-token");
});

test("an incorrect current password does not refresh or log out the participant", async ({ context, page }) => {
  const state = await setup(context, page, { wrongPassword: true });
  await page.goto("/participant/onboarding");
  await submitPassword(page);
  await expect(page.getByText("Current password is incorrect").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Secure Your Account" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("auth_token"))).toBe("old-access-token");
  expect(state.refreshRequests()).toBe(0);
});
