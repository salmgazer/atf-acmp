import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";

const cohortId = "f402a196-cc8a-4aa8-8b14-c42637af4a72";
const batchId = "e791e055-9d6b-4d04-836b-9acc7587dd38";
const builders = Array.from({ length: 30 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, participantId: `BUILDER-${i + 1}`,
  firstName: i === 0 ? "Beginner" : i === 1 ? "Awaiting" : "Builder", lastName: `Example ${i + 1}`,
  email: `builder${i + 1}@example.test`, country: "Ghana", cohortId, cohortName: "Builders cohort", group: i % 2 ? "South" : "North",
  preferredLanguage: "JavaScript", otherLanguage: null, languageProficiency: "Beginner",
  developmentExperience: i === 1 ? null : true, testingExperience: i === 1 ? null : true, deploymentExperience: i === 1 ? null : true,
  builderConfirm: i % 2 === 0, teamId: i === 0 ? "00000000-0000-4000-8000-000000000099" : null, teamName: i === 0 ? "Beginner team" : null,
  createdAt: "2026-11-20T00:00:00Z", status: "ready", skills: [], interests: [], onboardingComplete: true, mustChangePassword: false,
}));

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  const user = { id: "builder-staff", email: "staff@example.test", firstName: "Staff", role };
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "staff", url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem("auth_token", "builder-test-token");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "builder-test-token", portal: "staff", isAuthenticated: true }, version: 0 }));
    localStorage.setItem("acmp-staff-cohort-store", JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  await page.route("**/*onesignal*", route => route.abort());
  await page.routeWebSocket(/socket\.io/, socket => socket.close());
  const requests: { path: string; query: URLSearchParams; body?: Record<string, unknown> }[] = [];
  const state = { rejectBroadcast: false, errorList: false };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, ""), q = url.searchParams;
    if (path === "/auth/me") return route.fulfill({ json: user });
    if (path === "/cohorts") return route.fulfill({ json: { data: [{ id: cohortId, name: "Builders cohort", status: "active", groups: ["North", "South"], countries: ["Ghana", "Nigeria"] }] } });
    if (path === "/participants") return route.fulfill({ json: { data: builders.slice(0, 1), total: 1, totalPages: 1 } });
    if (path === "/participants/statistics") return route.fulfill({ json: { total: 30, byCountry: {} } });
    if (path === "/chat/channels/my") return route.fulfill({ json: [] });
    if (path.startsWith("/participants/builders")) {
      const body = route.request().postData() ? route.request().postDataJSON() : undefined;
      requests.push({ path, query: q, body });
      let rows = builders.filter(p => (!q.get("group") || p.group === q.get("group")) && (!q.get("country") || p.country === q.get("country")));
      if (q.get("confirmation") === "pending") rows = rows.filter(p => !p.builderConfirm);
      if (q.get("confirmation") === "confirmed") rows = rows.filter(p => p.builderConfirm);
      if (q.get("assignment") === "unassigned") rows = rows.filter(p => !p.teamId);
      if (q.get("assignment") === "assigned") rows = rows.filter(p => p.teamId);
      if (path.endsWith("/audience")) return route.fulfill({ json: { total: rows.length, audienceHash: "a".repeat(64) } });
      if (path.endsWith("/export")) return route.fulfill({ json: { csv: "Participant ID,Email,Group,Team\r\n" + rows.map(p => [p.participantId, p.email, p.group, p.teamName].join(",")).join("\r\n"), total: rows.length } });
      if (path.endsWith("/broadcasts")) {
        if (state.rejectBroadcast) return route.fulfill({ status: 503, json: { message: "Email delivery is unavailable" } });
        return route.fulfill({ json: { id: batchId, state: "queued", subject: body.subject, total: 30, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] } });
      }
      if (path.includes("/broadcasts/")) return route.fulfill({ json: { id: batchId, state: "completed", subject: "Builder update", total: 30, processed: 30, sent: 29, failed: 1, skipped: 0, failures: [{ participantId: "BUILDER-30", message: "Email delivery failed" }] } });
      if (state.errorList) return route.fulfill({ status: 503, json: { message: "Could not load builders" } });
      const pageNumber = Number(q.get("page") || 1), limit = Number(q.get("limit") || 25);
      return route.fulfill({ json: { data: rows.slice((pageNumber - 1) * limit, pageNumber * limit), total: rows.length, totalPages: Math.ceil(rows.length / limit), page: pageNumber, limit,
        summary: { total: rows.length, confirmed: rows.filter(p => p.builderConfirm).length, pending: rows.filter(p => !p.builderConfirm).length, assigned: rows.filter(p => p.teamId).length, unassigned: rows.filter(p => !p.teamId).length } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/staff/participants/builders");
  await expect(page.getByRole("heading", { name: "Builders", exact: true })).toBeVisible();
  return { requests, state };
}

test("participants has a Builders link and directory includes beginners, confirmation, Group and current Team", async ({ page, context }) => {
  await setup(page, context);
  const beginner = page.getByRole("row").filter({ hasText: "BUILDER-1" }).filter({ hasText: "Beginner Example 1" });
  await expect(beginner).toContainText("Beginner"); await expect(beginner).toContainText("Confirmed");
  await expect(beginner).toContainText("North"); await expect(beginner.getByRole("link", { name: "Beginner team" })).toHaveAttribute("href", `/staff/teams/${builders[0].teamId}`);
  const pending = page.getByRole("row").filter({ hasText: "Awaiting Example 2" });
  await expect(pending).toContainText("Awaiting confirmation"); await expect(pending).toContainText("Not answered"); await expect(pending).toContainText("Not assigned");
  await page.getByRole("main").getByRole("link", { name: "Participants", exact: true }).click();
  await page.getByRole("link", { name: "Builders", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/participants\/builders$/);
});

test("filters reset pagination and exports the full filtered list rather than only the displayed page", async ({ page, context }) => {
  const { requests } = await setup(page, context);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("26-30 of 30")).toBeVisible();
  await page.getByLabel("Builder confirmation").selectOption("pending");
  await expect(page.getByText("1-15 of 15")).toBeVisible();
  await page.getByLabel("Builder confirmation").selectOption("all");
  const downloadEvent = page.waitForEvent("download"); await page.getByRole("button", { name: "Export builders", exact: true }).click();
  const download = await downloadEvent;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("BUILDER-30"); expect(csv).toContain("Group,Team");
  const request = requests.find(r => r.path.endsWith("/export"))!;
  expect(request.query.get("cohortId")).toBe(cohortId); expect(request.query.has("page")).toBe(false);
});

test("broadcast reviews the full audience, requires content, and queues the reviewed filters with progress", async ({ page, context }) => {
  const { requests } = await setup(page, context);
  await page.getByRole("button", { name: "Email builders" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("30 builders will receive this email");
  await expect(dialog.getByRole("button", { name: "Send broadcast to 30 builders" })).toBeDisabled();
  await dialog.getByLabel("Subject", { exact: true }).fill("Builder update");
  await dialog.getByLabel("Message", { exact: true }).fill("Please confirm your builder experience.");
  await dialog.getByText("Preview message", { exact: true }).click();
  await expect(dialog.getByText("Hi [First name],", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Send broadcast to 30 builders" }).click();
  await expect(page.getByText("30 of 30 processed · 29 sent · 1 failed · 0 skipped")).toBeVisible();
  const request = requests.find(r => r.path.endsWith("/broadcasts"))!;
  expect(request.body).toMatchObject({ subject: "Builder update", message: "Please confirm your builder experience.", audienceHash: "a".repeat(64), filters: { cohortId, confirmation: "all", assignment: "all" } });
  expect(request.body?.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(request.body?.filters).not.toHaveProperty("page");
});

test("filtered broadcasts show the recipient scope clearly and preserve the draft on delivery errors", async ({ page, context }) => {
  const { state, requests } = await setup(page, context); state.rejectBroadcast = true;
  await page.getByLabel("Filter by group").selectOption("group:South");
  await page.getByLabel("Team assignment").selectOption("unassigned");
  await page.getByLabel("Builder confirmation").selectOption("pending");
  await page.getByRole("button", { name: "Email builders" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("15 builders will receive this email"); await expect(dialog).toContainText("South");
  await dialog.getByLabel("Subject", { exact: true }).fill("Pending builder update"); await dialog.getByLabel("Message", { exact: true }).fill("Please confirm your experience.");
  await dialog.getByRole("button", { name: "Send broadcast to 15 builders" }).click();
  await expect(page.getByText("Email delivery is unavailable", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Message", { exact: true })).toHaveValue("Please confirm your experience.");
  const firstId = requests.find(r => r.path.endsWith("/broadcasts"))!.body?.requestId;
  await expect(dialog.getByRole("button", { name: "Send broadcast to 15 builders" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Send broadcast to 15 builders" }).click();
  await expect.poll(() => requests.filter(r => r.path.endsWith("/broadcasts")).length).toBe(2);
  expect(requests.filter(r => r.path.endsWith("/broadcasts"))[1].body?.requestId).toBe(firstId);
});

test("viewers can read and export builders but cannot compose a broadcast", async ({ page, context }) => {
  await setup(page, context, "viewer");
  await expect(page.getByRole("button", { name: "Export builders" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Email builders" })).toHaveCount(0);
});

test("builders remain usable on a phone and empty country filters disable email and export", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page, context);
  await expect(page.getByRole("heading", { name: "Builders", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel("Builder country").selectOption("Nigeria");
  await expect(page.getByText("No builders match these filters.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email builders" })).toBeDisabled(); await expect(page.getByRole("button", { name: "Export builders" })).toBeDisabled();
});
