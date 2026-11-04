import { test, expect, type Page, type BrowserContext } from "@playwright/test";

test.use({ timezoneId: "Africa/Accra" });
const cohortId = "318cb096-48d3-4d3b-8db6-4ef6e6c21356", otherCohortId = "5c413f58-6e8e-4e53-9142-8f1ac38d9e9c";
const partner = { id: "partner-calendar", name: "Calendar Partner", email: "partner@example.test", status: "approved", isActive: true, createdAt: "2026-01-01T00:00:00Z" };
const base = { briefId: "brief-calendar", brief: { id: "brief-calendar", title: "Health AI brief" }, organization: { id: partner.id, name: partner.name }, description: "Discuss implementation questions and next steps", timezone: "Africa/Accra", durationMinutes: 60, status: "scheduled", zoomJoinUrl: "https://zoom.us/j/calendar", revision: 0, cohortId };
const events = [
  { ...base, id: "discussion", title: "Partner Q&A", startAt: "2026-11-04T10:00:00Z", endAt: "2026-11-04T11:00:00Z" },
  { ...base, id: "cancelled", title: "Cancelled workshop", startAt: "2026-11-05T10:00:00Z", endAt: "2026-11-05T11:00:00Z", status: "cancelled", zoomJoinUrl: null },
  { ...base, id: "overnight", title: "Overnight discussion", startAt: "2026-11-30T23:30:00Z", endAt: "2026-12-01T00:30:00Z" },
  { ...base, id: "timezone", title: "Timezone discussion", startAt: "2026-11-05T00:30:00Z", endAt: "2026-11-05T01:30:00Z" },
  { ...base, id: "other", title: "Other cohort event", cohortId: otherCohortId, startAt: "2026-11-04T14:00:00Z", endAt: "2026-11-04T15:00:00Z" },
  ...Array.from({ length: 4 }, (_, index) => ({ ...base, id: `extra-${index}`, title: `Extra event ${index + 1}`, startAt: `2026-11-04T${12 + index}:00:00Z`, endAt: `2026-11-04T${13 + index}:00:00Z` })),
];

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  await page.clock.setFixedTime(new Date("2026-11-04T12:00:00Z"));
  const user = { id: "partner-calendar-staff", role, email: "staff@example.test", firstName: "Staff" };
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "staff", url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, cohortId }) => {
    localStorage.setItem("auth_token", "test-access");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "test-access", portal: "staff", isAuthenticated: true }, version: 0 }));
    localStorage.setItem("acmp-staff-cohort-store", JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 }));
  }, { user, cohortId });
  const requests: URL[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (path === "/auth/me") data = user;
    else if (path === "/cohorts") data = { data: [{ id: cohortId, name: "Calendar cohort", status: "active" }, { id: otherCohortId, name: "Other cohort", status: "active" }], total: 2 };
    else if (path === "/organizations") data = { data: [partner], total: 1, totalPages: 1 };
    else if (path === "/organizations/statistics") data = {};
    else if (path === "/brief-events/calendar") {
      requests.push(url);
      data = { events: events.filter(event => event.cohortId === url.searchParams.get("cohortId")
        && new Date(event.startAt) < new Date(url.searchParams.get("endAt")!) && new Date(event.endAt) > new Date(url.searchParams.get("startAt")!)
        && event.organization.name.toLowerCase().includes((url.searchParams.get("search") || "").toLowerCase())) };
    } else if (path === "/brief-events/discussion/calendar") {
      await route.fulfill({ contentType: "text/calendar", body: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n" }); return;
    }
    await route.fulfill({ json: data });
  });
  await page.goto("/staff/partners");
  await expect(page.getByRole("heading", { name: "Partners", exact: true })).toBeVisible();
  return requests;
}
const calendar = (page: Page) => page.getByRole("region", { name: "Partner brief event calendar", exact: true });

test("partners list switches to a full event calendar with details, Zoom, links and download", async ({ page, context }) => {
  const requests = await setup(page, context);
  expect(requests).toHaveLength(0);
  await page.getByRole("checkbox", { name: "Select Calendar Partner", exact: true }).check();
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend selected invites" })).toHaveCount(0);
  await expect(calendar(page).getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expect(calendar(page).getByText("Extra event 4", { exact: false })).toBeVisible();
  await calendar(page).getByRole("button", { name: /10:00 AM · Partner Q&A/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(base.description);
  await expect(dialog.getByRole("link", { name: partner.name })).toHaveAttribute("href", `/staff/partners/${partner.id}`);
  await expect(dialog.getByRole("link", { name: "Health AI brief" })).toHaveAttribute("href", "/staff/briefs/brief-calendar");
  await expect(dialog.getByRole("link", { name: "Join Zoom" })).toHaveAttribute("href", base.zoomJoinUrl);
  await expect(dialog.getByRole("button", { name: /Start|Host/ })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Add to calendar" }).click();
  expect((await download).suggestedFilename()).toBe("brief-event.ics");
  await page.keyboard.press("Escape");
  expect(requests[0].searchParams.get("startAt")).toBe("2026-11-01T00:00:00.000Z");
  expect(requests[0].searchParams.get("endAt")).toBe("2026-12-06T00:00:00.000Z");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select Calendar Partner", exact: true })).not.toBeChecked();
});

test("calendar navigation, partner search and cohort selection load matching date ranges", async ({ page, context }) => {
  const requests = await setup(page, context);
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await calendar(page).getByRole("button", { name: "Next month" }).click();
  await expect(calendar(page).getByRole("heading", { name: "December 2026" })).toBeVisible();
  await expect(calendar(page).getByRole("cell", { name: "Tuesday, December 1, 2026", exact: true }).getByRole("button", { name: /Continues · Overnight discussion/ })).toBeVisible();
  await expect.poll(() => requests.at(-1)?.searchParams.get("endAt")).toBe("2027-01-03T00:00:00.000Z");
  await calendar(page).getByRole("button", { name: "Previous month" }).click();
  await expect(calendar(page).getByRole("heading", { name: "November 2026" })).toBeVisible();
  await calendar(page).getByRole("button", { name: "Next month" }).click();
  await calendar(page).getByRole("button", { name: "Today", exact: true }).click();
  await expect(calendar(page).getByRole("heading", { name: "November 2026" })).toBeVisible();
  await calendar(page).getByLabel("Filter events by partner").fill("No match");
  await expect(calendar(page).getByText("No partner events match this search in the displayed dates.")).toBeVisible();
  expect(requests.at(-1)?.searchParams.get("search")).toBe("No match");
  await calendar(page).getByLabel("Filter events by partner").fill("");
  await page.getByLabel("Cohort", { exact: true }).selectOption(otherCohortId);
  await expect(calendar(page).getByRole("button", { name: /Other cohort event/ })).toBeVisible();
  await expect(calendar(page).getByRole("button", { name: /Partner Q&A/ })).toHaveCount(0);
  expect(requests.at(-1)?.searchParams.get("cohortId")).toBe(otherCohortId);
});

test("cancelled events stay visible and do not provide a Zoom join link", async ({ page, context }) => {
  await setup(page, context);
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await calendar(page).getByRole("button", { name: /Cancelled workshop/ }).click();
  await expect(page.getByRole("dialog").getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Join Zoom" })).toHaveCount(0);
});

for (const role of ["viewer", "evaluator"]) test(`${role} can view partner events and every cohort without management actions`, async ({ page, context }) => {
  await setup(page, context, role);
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(calendar(page).getByRole("button", { name: /Partner Q&A/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend approved invites" })).toHaveCount(0);
  await page.getByLabel("Cohort", { exact: true }).selectOption(otherCohortId);
  await calendar(page).getByRole("button", { name: /Other cohort event/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Other cohort event");
});

test("calendar errors can be retried and empty months are explained", async ({ page, context }) => {
  await setup(page, context);
  let failing = true;
  await page.route("**/brief-events/calendar?*", route => failing ? route.fulfill({ status: 500, json: { message: "Unavailable" } }) : route.fulfill({ json: { events: [] } }));
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(calendar(page).getByText("Could not load partner events.")).toBeVisible({ timeout: 15000 });
  failing = false;
  await calendar(page).getByRole("button", { name: "Try again" }).click();
  await expect(calendar(page).getByText("No partner events scheduled in the displayed dates.")).toBeVisible();
});

test.describe("staff local timezone", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  test("events use the staff timezone for day placement and preserve the event timezone in details", async ({ page, context }) => {
    await setup(page, context);
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await calendar(page).getByRole("cell", { name: "Wednesday, November 4, 2026", exact: true }).getByRole("button", { name: /4:30 PM · Timezone discussion/ }).click();
    await expect(page.getByRole("dialog")).toContainText("America/Los_Angeles");
    await expect(page.getByRole("dialog")).toContainText("Africa/Accra");
  });
});
