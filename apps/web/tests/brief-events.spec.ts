import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const event = { id: "event-1", briefId: "event-brief", title: "Partner discussion", description: "Discuss team questions and next steps", startAt: "2030-06-01T10:00:00Z", endAt: "2030-06-01T11:00:00Z", timezone: "Africa/Accra", durationMinutes: 60, status: "scheduled", zoomJoinUrl: "https://zoom.us/j/123", revision: 0, attendeeCount: 4, deliveryPending: false };
const brief = { id: "event-brief", title: "Event testing brief", description: "Brief description", problemStatement: "Problem", expectedOutcomes: "Outcomes", status: "approved", cohortId: "cohort-1", organizationId: "org-1", organization: { name: "Partner organization" }, maxTeams: 3, teamsCount: 1, revisionCount: 0, tags: [], createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" };

async function setup(context: BrowserContext, page: Page, options: { participant?: boolean; empty?: boolean; configured?: boolean; contact?: boolean } = {}) {
  const portal = options.participant ? "participant" : "partner";
  const user = { id: "test-user", email: "user@example.test", firstName: "Test", lastName: "User", role: options.participant ? "participant" : "organization", onboardingComplete: true };
  const events = options.empty ? [] : [{ ...event }];
  const requests: { method: string; path: string; body: any }[] = [];
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: portal, url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, portal }) => {
    localStorage.setItem("auth_token", "test-access");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, portal, token: "test-access", isAuthenticated: true }, version: 0 }));
  }, { user, portal });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const body = route.request().postDataJSON();
    requests.push({ method, path, body });
    let data: unknown = [];
    if (path.endsWith("/auth/me")) data = user;
    else if (path.endsWith("/participants/me")) data = { ...user, participantId: "ATF-001", cohortId: "cohort-1", skills: [], interests: [] };
    else if (path.endsWith("/briefs/event-brief")) data = brief;
    else if (path.endsWith("/teams")) data = { data: [], total: 0, totalPages: 1 };
    else if (path.endsWith("/brief-events/brief/event-brief")) {
      if (method === "POST") { const created = { ...event, ...body }; events.push(created); data = created; }
      else data = { events, canManage: !options.participant && !options.contact, host: { name: "Designated Brief Contact", email: "host@example.test", source: "brief" }, canHost: !options.participant, zoomConfigured: !options.participant && options.configured !== false };
    } else if (path.endsWith("/brief-events/event-1") && method === "PATCH") { Object.assign(events[0], body); data = events[0]; }
    else if (path.endsWith("/brief-events/event-1/cancel")) { Object.assign(events[0], { status: "cancelled", zoomJoinUrl: null }); data = events[0]; }
    else if (path.endsWith("/brief-events/event-1/start")) data = { startUrl: "https://zoom.us/s/123?zak=protected-host-token" };
    else if (path.endsWith("/brief-events/event-1/calendar")) { await route.fulfill({ contentType: "text/calendar", body: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n" }); return; }
    else if (path.endsWith("/unread-count")) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  return { events, requests };
}

test("organizations schedule, edit and cancel brief events with a discussion agenda", async ({ context, page }) => {
  const { requests } = await setup(context, page, { empty: true });
  await page.goto("/partners/briefs/event-brief");
  const section = page.getByRole("region", { name: "Brief events", exact: true });
  await section.getByRole("button", { name: "Schedule event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Event title").fill("Organization Q&A");
  await dialog.getByLabel("What would you like to discuss?").fill("Review implementation questions");
  await dialog.getByLabel(/Date and time/).fill("2030-06-01T10:00");
  await dialog.getByLabel("Duration in minutes").fill("45");
  await dialog.getByRole("button", { name: "Schedule event", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Organization Q&A" })).toBeVisible();
  const payload = requests.find(request => request.method === "POST" && request.path.endsWith("/brief/event-brief"))?.body;
  expect(payload).toMatchObject({ title: "Organization Q&A", description: "Review implementation questions", durationMinutes: 45 });
  expect(payload).not.toHaveProperty("zoomJoinUrl");
  await section.getByRole("button", { name: "Edit event", exact: true }).click();
  await dialog.getByLabel("Event title").fill("Updated Q&A");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(section.getByRole("heading", { name: "Updated Q&A" })).toBeVisible();
  await section.getByRole("button", { name: "Cancel event", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel event", exact: true }).click();
  await expect(section.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(section.getByRole("link", { name: "Join Zoom" })).toHaveCount(0);
});

test("assigned participants can join Zoom and download an invitation without host controls", async ({ context, page }) => {
  await setup(context, page, { participant: true });
  await page.goto("/participant/briefs/event-brief");
  const section = page.getByRole("region", { name: "Brief events", exact: true });
  await expect(section.getByText(event.description)).toBeVisible();
  await expect(section.getByRole("link", { name: "Join Zoom" })).toHaveAttribute("href", event.zoomJoinUrl);
  await expect(section.getByRole("button", { name: "Host event" })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Schedule event" })).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await section.getByRole("button", { name: "Add to calendar" }).click();
  expect((await downloading).suggestedFilename()).toBe("brief-event.ics");
});

test("organization hosting requests a protected host URL only when clicked", async ({ context, page }) => {
  const { requests } = await setup(context, page);
  await context.route("https://zoom.us/**", route => route.fulfill({ contentType: "text/html", body: "<p>Mock Zoom host</p>" }));
  await page.goto("/partners/briefs/event-brief");
  const host = page.getByRole("region", { name: "Brief events", exact: true }).getByRole("button", { name: "Host event", exact: true });
  await expect(host).toBeVisible();
  expect(requests.some(request => request.path.endsWith("/start"))).toBe(false);
  const popup = page.waitForEvent("popup");
  await host.click();
  await expect(await popup).toHaveURL(/zoom\.us\/s\/123/);
  expect(requests.filter(request => request.method === "POST" && request.path.endsWith("/start"))).toHaveLength(1);
});

test("event scheduling explains when shared Zoom configuration is missing", async ({ context, page }) => {
  await setup(context, page, { empty: true, configured: false });
  await page.goto("/partners/briefs/event-brief");
  const section = page.getByRole("region", { name: "Brief events", exact: true });
  await expect(section.getByRole("button", { name: "Schedule event" })).toBeDisabled();
  await expect(section.getByText(/once staff connects the shared ATF Zoom account/)).toBeVisible();
});

test("a designated brief contact can host without scheduling, editing or cancelling events", async ({ context, page }) => {
  await setup(context, page, { contact: true });
  await page.goto("/partners/briefs/event-brief");
  const section = page.getByRole("region", { name: "Brief events", exact: true });
  await expect(section.getByText("Event host: Designated Brief Contact (brief main contact)")).toBeVisible();
  await expect(section.getByRole("button", { name: "Host event", exact: true })).toBeVisible();
  for (const action of ["Schedule event", "Edit event", "Cancel event"]) await expect(section.getByRole("button", { name: action, exact: true })).toHaveCount(0);
});
