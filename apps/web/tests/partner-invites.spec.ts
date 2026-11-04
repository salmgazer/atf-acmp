import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const cohortId = "318cb096-48d3-4d3b-8db6-4ef6e6c21356", batchId = "8cbdd567-37d6-48da-941f-2648e2bbfa99";
const partners = [
  { id: "b9ebd119-911e-4bbd-b9c2-bcf876878650", name: "First Partner", status: "approved", isActive: true },
  { id: "7dca10c3-337e-4c84-8ce7-74a979fb3d97", name: "Second Partner", status: "approved", isActive: true },
  { id: "09e05ba5-e6b0-425d-bd2f-c39edf699826", name: "Pending Partner", status: "pending", isActive: true },
  { id: "018c1ed0-00d0-4ca3-92df-47b5e985f292", name: "Inactive Partner", status: "approved", isActive: false },
].map(partner => ({ ...partner, email: `${partner.name.split(" ")[0].toLowerCase()}@example.test`, cohortId, createdAt: "2026-01-01T00:00:00Z" }));

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  const user = { id: "partner-bulk-staff", role, email: "staff@example.test", firstName: "Staff" };
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
    else if (path === "/cohorts") data = { data: [{ id: cohortId, name: "Bulk partner cohort" }], total: 1 };
    else if (path === "/organizations") {
      const status = url.searchParams.get("status");
      data = { data: status ? partners.filter(p => p.status === status) : partners, total: 40, totalPages: 2 };
    } else if (path === "/organizations/statistics") data = {};
    else if (route.request().method() === "POST" && path.endsWith("/send-invite")) {
      sent.push({ path, body: route.request().postDataJSON() });
      data = { organizationId: partners[0].id, email: partners[0].email, success: true };
    }
    else if (route.request().method() === "POST" && path.includes("resend")) {
      const body = route.request().postDataJSON(); sent.push({ path, body });
      const total = path.endsWith("resend-eligible-invites") ? 30 : body.organizationIds.length;
      data = { id: batchId, state: "queued", total, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    } else if (path === `/organizations/invite-resends/${batchId}`) {
      const last = sent[sent.length - 1], total = last?.path.endsWith("resend-eligible-invites") ? 30 : last?.body.organizationIds.length || 2;
      data = { id: batchId, state: "completed", total, processed: total, sent: total, failed: 0, skipped: 0, failures: [] };
    }
    await route.fulfill({ json: data });
  });
  await page.goto("/staff/partners");
  await expect(page.getByRole("heading", { name: "Partners", exact: true })).toBeVisible();
  return sent;
}

test("partner bulk selection includes only approved rows and sends selected IDs after confirmation", async ({ page, context }) => {
  const sent = await setup(page, context);
  await expect(page.getByRole("checkbox", { name: "Select Pending Partner" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select Inactive Partner" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Select First Partner" }).check();
  const all = page.getByRole("checkbox", { name: "Select all approved active partners on this page" });
  await expect(all).toHaveAttribute("aria-checked", "mixed");
  await all.check();
  await expect(page.getByText("2 selected on this page")).toBeVisible();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2 selected approved, active partners");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(sent).toHaveLength(0);
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: "/organizations/resend-invites", body: { organizationIds: partners.slice(0, 2).map(m => m.id) } });
  await expect(page.getByText("Partner invitation resend complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
});

test("all-approved resend respects cohort and search filters across all pages", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Approved", exact: true }).click();
  await page.getByPlaceholder("Search partners...").fill("Partner");
  await page.getByRole("button", { name: "Resend approved invites", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Bulk partner cohort matching the current filters, across all pages");
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: "/organizations/resend-eligible-invites", body: { cohortId, status: "approved", search: "Partner" } });
  await expect(page.getByText("30 of 30 processed · 30 sent · 0 failed · 0 skipped")).toBeVisible();
});

test("selection clears on pagination and filters; pending and rejected views cannot resend all", async ({ page, context }) => {
  await setup(page, context);
  await page.getByRole("checkbox", { name: "Select First Partner" }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Select First Partner" }).check();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend approved invites" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select Pending Partner" })).toBeDisabled();
  await page.getByRole("button", { name: "Rejected", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend approved invites" })).toBeDisabled();
});

for (const role of ["viewer", "evaluator"]) test(`${role} cannot select or bulk-resend partner invites`, async ({ page, context }) => {
  await setup(page, context, role);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend approved invites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
});

test("partner bulk failures and progress survive a page reload", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.route(`**/organizations/invite-resends/${batchId}`, route => route.fulfill({ json: { id: batchId, state: "completed", total: 2, processed: 2, sent: 1, failed: 1, skipped: 0, failures: [{ organizationId: partners[1].id, email: partners[1].email, message: "Email delivery failed" }] } }));
  await page.getByRole("checkbox", { name: "Select all approved active partners on this page" }).check();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText(`Failed partners: ${partners[1].email}`)).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 of 2 processed · 1 sent · 1 failed · 0 skipped")).toBeVisible();
  expect(sent).toHaveLength(1);
});

test("stale partner selection errors preserve the selection", async ({ page, context }) => {
  await setup(page, context);
  await page.route("**/organizations/resend-invites", route => route.fulfill({ status: 400, json: { message: "Only approved, active, non-deleted partners can receive an invite." } }));
  await page.getByRole("checkbox", { name: "Select First Partner" }).check();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText("Only approved, active, non-deleted partners can receive an invite.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("1 selected on this page")).toBeVisible();
});

test("an active partner invitation batch disables duplicate bulk and row resend actions", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.route(`**/organizations/invite-resends/${batchId}`, route => route.fulfill({ json: { id: batchId, state: "active", total: 2, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] } }));
  await page.getByRole("button", { name: "Resend approved invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText("Resending partner invitations", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend approved invites", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select First Partner" })).toBeDisabled();
  await page.getByRole("button", { name: "Actions for First Partner" }).click();
  await expect(page.getByRole("menuitem", { name: "Resend Invite", exact: true })).toBeDisabled();
  expect(sent).toHaveLength(1);
});

test("row resend is available only for approved active partners and reports delivery errors", async ({ page, context }) => {
  const sent = await setup(page, context);
  for (const name of ["Pending Partner", "Inactive Partner"]) {
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await expect(page.getByRole("menuitem", { name: "Resend Invite", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Actions for First Partner" }).click();
  await page.getByRole("menuitem", { name: "Resend Invite", exact: true }).click();
  await expect(page.getByText(`Invite sent to ${partners[0].email}`, { exact: true })).toBeVisible();
  expect(sent[0]).toEqual({ path: `/organizations/${partners[0].id}/send-invite`, body: {} });
  await page.route(`**/organizations/${partners[0].id}/send-invite`, route => route.fulfill({ status: 503, json: { message: "Could not send the partner invitation. Please try again." } }));
  await page.getByRole("button", { name: "Actions for First Partner" }).click();
  await page.getByRole("menuitem", { name: "Resend Invite", exact: true }).click();
  await expect(page.getByText("Could not send the partner invitation. Please try again.", { exact: true })).toBeVisible();
});
