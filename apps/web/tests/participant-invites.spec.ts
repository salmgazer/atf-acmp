import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const cohortId = "f402a196-cc8a-4aa8-8b14-c42637af4a72";
const batchId = "e791e055-9d6b-4d04-836b-9acc7587dd38";
const cohort = { id: cohortId, name: "Invite cohort", status: "active", groups: ["North", "South"] };
const participants = [
  { id: "5f4102ee-a04a-4e11-a07e-37a65e16cf5e", participantId: "P001", firstName: "Jane", lastName: "Pending", status: "imported", mustChangePassword: true, onboardingComplete: false },
  { id: "9f6c39fc-22ac-4d34-9401-bac82a7f2354", participantId: "P002", firstName: "John", lastName: "Pending", status: "onboarding", mustChangePassword: true, onboardingComplete: false },
  { id: "3faf145c-bde1-44fb-af9f-e4d4ef7dbb32", participantId: "P003", firstName: "Alex", lastName: "Accepted", status: "onboarding", mustChangePassword: false, onboardingComplete: false },
  { id: "5809cd80-47d2-457e-a5e3-3c58f2479338", participantId: "P004", firstName: "Sam", lastName: "Inactive", status: "inactive", mustChangePassword: true, onboardingComplete: false },
].map(p => ({ ...p, email: `${p.participantId}@example.test`, country: "GH", group: "North", cohortId, createdAt: "2026-01-01T00:00:00Z" }));

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  const user = { id: "invite-staff", role, email: "staff@example.test", firstName: "Staff" };
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "staff", url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem("auth_token", "test-access");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "test-access", portal: "staff", isAuthenticated: true }, version: 0 }));
    localStorage.setItem("acmp-staff-cohort-store", JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  const sent: { path: string; body: unknown }[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    let data: unknown = {};
    if (path === "/auth/me") data = user;
    else if (path === "/cohorts") data = { data: [cohort], total: 1 };
    else if (path === "/participants") data = { data: participants, total: 40, totalPages: 2 };
    else if (path === "/participants/statistics") data = { total: 40, imported: 25, byCountry: { GH: 40 } };
    else if (path === "/chat/channels/my") data = [];
    else if (route.request().method() === "POST" && path.includes("resend")) {
      const body = route.request().postData() ? route.request().postDataJSON() : null;
      sent.push({ path, body });
      const total = path.endsWith("resend-pending-invites") ? 30 : path.endsWith("resend-invites") ? (body.participantIds as string[]).length : 1;
      data = { id: batchId, state: "queued", total, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    } else if (path === `/participants/invite-resends/${batchId}`) {
      const last = sent[sent.length - 1];
      const total = last?.path.endsWith("resend-pending-invites") ? 30 : last?.path.endsWith("resend-invites") ? (last.body as { participantIds: string[] }).participantIds.length : 1;
      data = { id: batchId, state: "completed", total, processed: total, sent: total, failed: 0, skipped: 0, failures: [] };
    }
    await route.fulfill({ json: data });
  });
  await page.goto("/staff/participants");
  await expect(page.getByRole("heading", { name: "Participants", exact: true })).toBeVisible();
  return sent;
}

test("participant row menus provide view and resend actions with pending eligibility", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.getByRole("button", { name: "Actions for Jane Pending" }).click();
  await expect(page.getByRole("menuitem", { name: "View participant" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Resend invite", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].path).toBe(`/participants/${participants[0].id}/resend-invite`);
  await expect(page.getByText("Invitation resend complete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Actions for Alex Accepted" }).click();
  await expect(page.getByRole("menuitem", { name: "Resend invite", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("checkbox", { name: "Select Alex Accepted" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Select Sam Inactive" })).toBeDisabled();
});

test("select-all includes only pending participants and bulk resend sends the selected IDs", async ({ page, context }) => {
  const sent = await setup(page, context);
  const selectAll = page.getByRole("checkbox", { name: "Select all pending participants on this page" });
  await page.getByRole("checkbox", { name: "Select Jane Pending" }).check();
  await expect(selectAll).toHaveAttribute("aria-checked", "mixed");
  await selectAll.check();
  await expect(page.getByText("2 selected on this page")).toBeVisible();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2 selected participants");
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: "/participants/resend-invites", body: { participantIds: participants.slice(0, 2).map(p => p.id) } });
  await expect(page.getByText("Invitation resend complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
});

test("all-pending resends use the current cohort and filters across every page", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Filter by group").selectOption("group:North");
  await page.getByPlaceholder("Search by name, email, or ID...").fill("Pending");
  await page.getByRole("button", { name: "Resend pending invites", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Invite cohort matching the current filters, across all pages");
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: "/participants/resend-pending-invites", body: { cohortId, group: "North", search: "Pending" } });
  await expect(page.getByText("30 of 30 processed · 30 sent · 0 failed · 0 skipped")).toBeVisible();
});

test("changing filters and pages clears the selection", async ({ page, context }) => {
  await setup(page, context);
  await page.getByRole("checkbox", { name: "Select Jane Pending" }).check();
  await page.getByPlaceholder("Search by name, email, or ID...").fill("Jane");
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Select Jane Pending" }).check();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
});

for (const role of ["viewer", "evaluator"]) test(`${role} can view row details but cannot select or resend invitations`, async ({ page, context }) => {
  await setup(page, context, role);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resend pending invites" })).toHaveCount(0);
  await page.getByRole("button", { name: "Actions for Jane Pending" }).click();
  await expect(page.getByRole("menuitem", { name: "View participant" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Resend invite", exact: true })).toHaveCount(0);
});

test("delivery failures remain visible and batch progress survives reload", async ({ page, context }) => {
  const sent = await setup(page, context);
  await page.route(`**/participants/invite-resends/${batchId}`, route => route.fulfill({ json: { id: batchId, state: "completed", total: 2, processed: 2, sent: 1, failed: 1, skipped: 0, failures: [{ participantId: "P002", message: "Email delivery failed" }] } }));
  await page.getByRole("checkbox", { name: "Select all pending participants on this page" }).check();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText("Failed participant IDs: P002")).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 of 2 processed · 1 sent · 1 failed · 0 skipped")).toBeVisible();
  expect(sent).toHaveLength(1);
});

test("a stale selection or delivery configuration error preserves the selection for correction", async ({ page, context }) => {
  await setup(page, context);
  await page.route("**/participants/resend-invites", route => route.fulfill({ status: 400, json: { message: "Only active participants who have not changed their initial password can receive an invite." } }));
  await page.getByRole("checkbox", { name: "Select Jane Pending" }).check();
  await page.getByRole("button", { name: "Resend selected invites", exact: true }).click();
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByText("Only active participants who have not changed their initial password can receive an invite.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("1 selected on this page")).toBeVisible();
});
