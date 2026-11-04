import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const cohortId = "389a9964-9af7-4ca9-9170-9ed64ab69d09";
const mentors = ["imported", "active", "inactive"].map((status, index) => ({
  id: ["7cdb3234-e5f8-48bb-988b-740e3731c64f", "da660ce5-62ce-48e5-9eb8-37cc1c011fd1", "079c030b-9ba8-4d38-8df7-a13b43db6efc"][index],
  email: `${status}@example.test`, firstName: status[0].toUpperCase() + status.slice(1), lastName: "Mentor", status,
  cohortId, expertise: [], verticalScope: [], maxTeams: 3, assignments: [], scheduledSessions: [], sessionRateOverride: null,
  createdAt: "2026-01-01T00:00:00Z",
}));

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  const user = { id: "mentor-admin", firstName: "Staff", email: "staff@example.test", role };
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "staff", url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem("auth_token", "test-access");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "test-access", portal: "staff", isAuthenticated: true }, version: 0 }));
    localStorage.setItem("acmp-staff-cohort-store", JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  const requests: { path: string; body: any; method: string }[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (path === "/auth/me") data = user;
    else if (path === "/cohorts") data = { data: [{ id: cohortId, name: "Mentor cohort" }], total: 1 };
    else if (path === "/mentors") data = { data: mentors, total: 3, totalPages: 1 };
    else if (path === "/mentors/statistics") data = { total: 3, imported: 1, active: 1, inactive: 1 };
    else if (path.startsWith("/mentors/")) {
      const mentor = mentors.find(mentor => path === `/mentors/${mentor.id}`);
      if (route.request().method() === "PATCH" || route.request().method() === "POST") {
        const body = route.request().postData() ? route.request().postDataJSON() : null;
        requests.push({ path, body, method: route.request().method() });
        data = mentor ? { ...mentor, ...body } : { message: "Mentor invitation sent" };
      } else data = mentor || [];
    } else if (path.startsWith("/mentor-payments/earnings")) data = {};
    await route.fulfill({ json: data });
  });
  return requests;
}

test("only imported mentors have a resend action in their staff menu", async ({ page, context }) => {
  const requests = await setup(page, context);
  await page.goto("/staff/mentors");
  await page.getByRole("button", { name: "Actions for Imported Mentor" }).click();
  await page.getByRole("menuitem", { name: "Resend Invite", exact: true }).click();
  await expect(page.getByText("Mentor invitation sent", { exact: true })).toBeVisible();
  expect(requests).toEqual([{ path: `/mentors/${mentors[0].id}/resend-invite`, body: null, method: "POST" }]);
  for (const name of ["Active", "Inactive"]) {
    await page.getByRole("button", { name: `Actions for ${name} Mentor` }).click();
    await expect(page.getByRole("menuitem", { name: "Resend Invite", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
});

test("staff can correct an imported mentor email and the save request uses the new address", async ({ page, context }) => {
  const requests = await setup(page, context);
  await page.goto(`/staff/mentors/${mentors[0].id}/edit`);
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  await page.getByLabel("Email", { exact: true }).fill("Corrected@Example.test");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ path: `/mentors/${mentors[0].id}`, method: "PATCH", body: { email: "corrected@example.test", status: "imported" } });
});

for (const mentor of mentors.slice(1)) test(`${mentor.status} mentors keep a read-only email field while other edits still work`, async ({ page, context }) => {
  const requests = await setup(page, context);
  await page.goto(`/staff/mentors/${mentor.id}/edit`);
  await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
  await page.getByPlaceholder("John", { exact: true }).fill("Updated");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].body).toMatchObject({ firstName: "Updated", status: mentor.status });
  expect(requests[0].body).not.toHaveProperty("email");
});

test("email validation prevents invalid corrections and server conflicts keep the form open", async ({ page, context }) => {
  const requests = await setup(page, context);
  await page.goto(`/staff/mentors/${mentors[0].id}/edit`);
  await page.getByLabel("Email", { exact: true }).fill("invalid-email");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  expect(requests).toHaveLength(0);
  expect(await page.getByLabel("Email", { exact: true }).evaluate((node: HTMLInputElement) => node.validity.typeMismatch)).toBe(true);
  await page.route(`**/api/mentors/${mentors[0].id}`, async route => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 409, json: { message: "This email is already used by another account" } });
    else await route.fallback();
  });
  await page.getByLabel("Email", { exact: true }).fill("existing@example.test");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("This email is already used by another account", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/mentors/${mentors[0].id}/edit$`));
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("existing@example.test");
});

for (const role of ["viewer", "evaluator"]) test(`${role} cannot resend mentor invitations or open the edit form`, async ({ page, context }) => {
  await setup(page, context, role);
  await page.goto("/staff/mentors");
  await page.getByRole("button", { name: "Actions for Imported Mentor" }).click();
  await expect(page.getByRole("menuitem", { name: "Resend Invite", exact: true })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toHaveCount(0);
  await page.goto(`/staff/mentors/${mentors[0].id}/edit`);
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});
