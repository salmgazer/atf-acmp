import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const cohortId = "318cb096-48d3-4d3b-8db6-4ef6e6c21356", batchId = "8cbdd567-37d6-48da-941f-2648e2bbfa99";
const mentors = [
  { id: "b9ebd119-911e-4bbd-b9c2-bcf876878650", firstName: "First", status: "imported" },
  { id: "7dca10c3-337e-4c84-8ce7-74a979fb3d97", firstName: "Second", status: "imported" },
  { id: "09e05ba5-e6b0-425d-bd2f-c39edf699826", firstName: "Active", status: "active" },
  { id: "018c1ed0-00d0-4ca3-92df-47b5e985f292", firstName: "Inactive", status: "inactive" },
].map(mentor => ({ ...mentor, lastName: "Mentor", email: `${mentor.firstName.toLowerCase()}@example.test`, cohortId, expertise: [], verticalScope: [], maxTeams: 3, createdAt: "2026-01-01T00:00:00Z" }));

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  const user = { id: "mentor-bulk-staff", role, email: "staff@example.test", firstName: "Staff" };
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "staff", url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem("auth_token", "test-access");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "test-access", portal: "staff", isAuthenticated: true }, version: 0 }));
    localStorage.setItem("acmp-staff-cohort-store", JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  const sent: { path: string; body: any }[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (path === "/auth/me") data = user;
    else if (path === "/cohorts") data = { data: [{ id: cohortId, name: "Bulk mentor cohort" }], total: 1 };
    else if (path === "/mentors") {
      const deleted = url.searchParams.get("deleted") === "true", status = url.searchParams.get("status");
      data = { data: deleted ? [{ ...mentors[0], firstName: "Deleted", deletedAt: "2026-01-01T00:00:00Z" }] : status ? mentors.filter(m => m.status === status) : mentors, total: 40, totalPages: 2 };
    } else if (path === "/mentor-payments/earnings/summary" || path === "/mentors/statistics") data = {};
    else if (route.request().method() === "POST" && path.includes("resend")) {
      const body = route.request().postDataJSON(); sent.push({ path, body });
      const total = path.endsWith("resend-imported-invites") ? 30 : body.mentorIds.length;
      data = { id: batchId, state: "queued", total, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    } else if (path === `/mentors/invite-resends/${batchId}`) {
      const last = sent[sent.length - 1], total = last?.path.endsWith("resend-imported-invites") ? 30 : last?.body.mentorIds.length || 2;
      data = { id: batchId, state: "completed", total, processed: total, sent: total, failed: 0, skipped: 0, failures: [] };
    }
    await route.fulfill({ json: data });
  });
  await page.goto("/staff/mentors");
  await expect(page.getByRole("heading", { name: "Mentors", exact: true })).toBeVisible();
  return sent;
}

test("mentor bulk selection includes only imported rows and sends selected IDs after confirmation", async ({ page, context }) => {
  const sent = await setup(page, context);
  await expect(page.getByRole("checkbox", { name: "Select Active Mentor" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select Inactive Mentor" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Select First Mentor" }).check();
  const all = page.getByRole("checkbox", { name: "Select all imported mentors on this page" });
  await expect(all).toHaveAttribute("aria-checked", "mixed");
  await all.check();
  await expect(page.getByText("2 selected on this page")).toBeVisible();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2 selected imported mentors");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(sent).toHaveLength(0);
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: "/mentors/resend-invites", body: { mentorIds: mentors.slice(0, 2).map(m => m.id) } });
  await expect(page.getByText("Mentor invitation resend complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
});

test("all-imported resend respects cohort, search and capacity filters across all pages", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Imported", exact: true }).click();
  await page.locator('select:has(option[value="available"])').selectOption("full");
  await page.getByPlaceholder("Search mentors...").fill("Mentor");
  await page.getByRole("button", { name: "Resend imported invites", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Bulk mentor cohort matching the current filters, across all pages");
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: "/mentors/resend-imported-invites", body: { cohortId, status: "imported", hasCapacity: false, search: "Mentor" } });
  await expect(page.getByText("30 of 30 processed · 30 sent · 0 failed · 0 skipped")).toBeVisible();
});

test("selection clears on pagination and filters; active and deleted views cannot resend all", async ({ page, context }) => {
  await setup(page, context);
  await page.getByRole("checkbox", { name: "Select First Mentor" }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Select First Mentor" }).check();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend imported invites" })).toBeDisabled();
  await page.getByRole("button", { name: "Deleted", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select Deleted Mentor" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select all imported mentors on this page" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resend imported invites" })).toBeDisabled();
});

for (const role of ["viewer", "evaluator"]) test(`${role} cannot select or bulk-resend mentor invites`, async ({ page, context }) => {
  await setup(page, context, role);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend imported invites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
});

test("mentor bulk failures and progress survive a page reload", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.route(`**/mentors/invite-resends/${batchId}`, route => route.fulfill({ json: { id: batchId, state: "completed", total: 2, processed: 2, sent: 1, failed: 1, skipped: 0, failures: [{ mentorId: mentors[1].id, email: mentors[1].email, message: "Email delivery failed" }] } }));
  await page.getByRole("checkbox", { name: "Select all imported mentors on this page" }).check();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText(`Failed mentors: ${mentors[1].email}`)).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 of 2 processed · 1 sent · 1 failed · 0 skipped")).toBeVisible();
  expect(sent).toHaveLength(1);
});

test("stale mentor selection errors preserve the selection", async ({ page, context }) => {
  await setup(page, context);
  await page.route("**/mentors/resend-invites", route => route.fulfill({ status: 400, json: { message: "Only imported, non-deleted mentors can receive an invite." } }));
  await page.getByRole("checkbox", { name: "Select First Mentor" }).check();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText("Only imported, non-deleted mentors can receive an invite.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("1 selected on this page")).toBeVisible();
});

test("an active mentor invitation batch disables duplicate bulk and row resend actions", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.route(`**/mentors/invite-resends/${batchId}`, route => route.fulfill({ json: { id: batchId, state: "active", total: 2, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] } }));
  await page.getByRole("button", { name: "Resend imported invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText("Resending mentor invitations", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend imported invites", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select First Mentor" })).toBeDisabled();
  await page.getByRole("button", { name: "Actions for First Mentor" }).click();
  await expect(page.getByRole("menuitem", { name: "Resend Invite", exact: true })).toBeDisabled();
  expect(sent).toHaveLength(1);
});
