import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const participantId = "00000000-0000-4000-8000-000000000001";
const channelId = "00000000-0000-4000-8000-000000000002";
const otherChannelId = "00000000-0000-4000-8000-000000000003";
const messageId = "00000000-0000-4000-8000-000000000004";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => { const list: string[] = []; errors.set(page, list); page.on("pageerror", error => list.push(error.message)); });
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function setup(page: Page, context: BrowserContext, options: { hidden?: boolean; unfocused?: boolean; link?: string; noMessages?: boolean; globalEmail?: boolean } = {}) {
  const user = { id: participantId, role: "participant", email: "participant@example.test", firstName: "Synthetic", lastName: "Reader", participantId: "SYNTHETIC-001", cohortId: "test-cohort", onboardingComplete: true, mustChangePassword: false, status: "assigned", country: "Ghana", skills: [], interests: [] };
  const channel = { id: channelId, name: "Current team conversation", type: "team", memberCount: 3, isPrivate: true, isArchived: false, createdAt: "2026-11-01T12:00:00Z" };
  const other = { ...channel, id: otherChannelId, name: "Renamed linked conversation" };
  const makeMessage = (id: string, content: string) => ({ id, channelId, senderId: "teammate", senderType: "participant", senderName: "Teammate", content, messageType: "text", createdAt: "2026-11-26T10:00:00Z", reactions: [], isDeleted: false, isEdited: false });
  const messages = options.noMessages ? [] : [makeMessage(messageId, "A message waiting for you")];
  const reads: { channelId: string; messageId?: string }[] = [], settings: Record<string, unknown>[] = [];
  let preferences = { id: "preferences", inAppEnabled: true, emailEnabled: options.globalEmail !== false, pushEnabled: true, typeSettings: { chat_message: { email: true, push: false }, team_invitation: { email: true } }, quietHoursStart: "", quietHoursEnd: "", timezone: "UTC" };
  const sockets = new Set<{ send(value: string): void }>();
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "participant", url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, options }) => {
    localStorage.setItem("auth_token", "synthetic-chat-token");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "synthetic-chat-token", portal: "participant", isAuthenticated: true }, version: 0 }));
    const state = window as any;
    state.chatVisible = !options.hidden; state.chatFocused = !options.unfocused; state.chatClockOffset = 0;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state.chatVisible ? "visible" : "hidden" });
    document.hasFocus = () => state.chatFocused;
    const clock = Date.now.bind(Date); Date.now = () => clock() + state.chatClockOffset;
  }, { user, options });
  await page.route("**/*onesignal*", route => route.abort());
  await page.routeWebSocket(/socket\.io/, ws => {
    ws.send('0{"sid":"synthetic-engine","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
    ws.onMessage(data => {
      const text = String(data);
      if (text.startsWith("40/")) {
        const namespace = text.slice(2).split(",")[0];
        ws.send(`40${namespace},{"sid":"synthetic-socket"}`);
        if (namespace === "/chat") sockets.add(ws);
      }
      if (text === "2") ws.send("3");
    });
    ws.onClose(() => sockets.delete(ws));
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, ""), method = route.request().method();
    let data: unknown = {};
    if (path === "/participants/me" || path === "/auth/me") data = user;
    else if (path === "/chat/channels/my") data = [{ channel, unreadCount: messages.length }, { channel: other, unreadCount: 0 }];
    else if (path === `/chat/channels/${channelId}`) data = channel;
    else if (path === `/chat/channels/${otherChannelId}`) data = other;
    else if (/\/chat\/channels\/[^/]+\/members$/.test(path)) data = [];
    else if (/\/chat\/channels\/[^/]+\/messages$/.test(path)) data = { messages, hasMore: false };
    else if (/\/chat\/channels\/[^/]+\/read$/.test(path)) {
      reads.push({ channelId: path.split("/")[3], ...route.request().postDataJSON() });
      return route.fulfill({ status: 204, body: "" });
    } else if (path === "/notifications/preferences") {
      if (method === "PATCH") { const body = route.request().postDataJSON(); settings.push(body); preferences = { ...preferences, ...body }; }
      data = preferences;
    } else if (path.includes("/teams/my/")) data = null;
    else if (path === "/notifications/count") data = { unread: 0, total: 0 };
    else if (path === "/cohorts/test-cohort") data = { id: "test-cohort", name: "Test cohort", status: "active" };
    await route.fulfill({ json: data });
  });
  await page.goto(options.link || "/participant/chat");
  if (options.link?.includes("emailSettings=1")) await expect(page.getByRole("dialog", { name: "Chat email notifications" })).toBeVisible();
  else await expect(page.getByRole("heading", { name: options.link?.includes(otherChannelId) ? other.name : channel.name, exact: true })).toBeVisible();
  return { reads, settings, messages, async incoming() {
    const next = makeMessage("00000000-0000-4000-8000-000000000005", "A newly received message"); messages.push(next);
    await expect.poll(() => sockets.size).toBeGreaterThan(0);
    for (const socket of sockets) socket.send(`42/chat,${JSON.stringify(["new_message", { channelId, channelType: "team", message: next }])}`);
    await expect(page.getByText(next.content, { exact: true })).toBeVisible();
    return next;
  } };
}

test("a hidden chat does not acknowledge deliveries and catches up to the last visible message on return", async ({ page, context }) => {
  const state = await setup(page, context, { hidden: true });
  await expect(page.getByText("A message waiting for you", { exact: true })).toBeVisible();
  const newest = await state.incoming(); expect(state.reads).toEqual([]);
  await page.evaluate(() => { (window as any).chatVisible = true; document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => state.reads.length).toBeGreaterThan(0);
  expect(state.reads.at(-1)).toEqual({ channelId, messageId: newest.id });
  expect(state.reads.some(read => !read.messageId)).toBe(false);
});

test("an unfocused chat leaves new messages unread until the user returns", async ({ page, context }) => {
  const state = await setup(page, context, { unfocused: true });
  const newest = await state.incoming(); expect(state.reads).toEqual([]);
  await page.evaluate(() => { (window as any).chatFocused = true; window.dispatchEvent(new Event("focus")); });
  await expect.poll(() => state.reads.at(-1)?.messageId).toBe(newest.id);
});

test("idle users do not generate read receipts merely because new messages auto-scroll", async ({ page, context }) => {
  const state = await setup(page, context);
  await expect.poll(() => state.reads.at(-1)?.messageId).toBe(messageId);
  const previous = state.reads.length;
  await page.evaluate(() => { (window as any).chatClockOffset = 130_000; });
  const newest = await state.incoming();
  expect(state.reads.length).toBe(previous);
  await page.mouse.move(120, 180);
  await expect.poll(() => state.reads.at(-1)?.messageId).toBe(newest.id);
});

test("empty chats are not marked read before a message is displayed", async ({ page, context }) => {
  const state = await setup(page, context, { noMessages: true });
  await expect(page.getByText("No messages yet", { exact: false })).toBeVisible(); expect(state.reads).toEqual([]);
  const newest = await state.incoming(); await expect.poll(() => state.reads.at(-1)?.messageId).toBe(newest.id);
});

test("email conversation links use the stable channel ID even when the conversation has been renamed", async ({ page, context }) => {
  await setup(page, context, { link: `/participant/chat?channelId=${otherChannelId}` });
  await expect(page.getByRole("heading", { name: "Renamed linked conversation", exact: true })).toBeVisible();
});

test("participants can disable chat email without changing other preferences", async ({ page, context }) => {
  const state = await setup(page, context);
  await page.getByRole("button", { name: "Chat email notifications" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Email me about unread team chat", exact: false }).uncheck();
  await dialog.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Email preferences saved", { exact: true })).toBeVisible();
  expect(state.settings[0]).toMatchObject({ emailEnabled: true, typeSettings: { chat_message: { email: false, push: false }, team_invitation: { email: true } } });
});

test("email settings links open preferences on mobile and save quiet hours in the selected timezone", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, context, { link: `/participant/chat?channelId=${channelId}&emailSettings=1` });
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await page.getByLabel("Quiet hours start", { exact: true }).fill("22:00");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Set both quiet-hour times" })).toBeVisible(); expect(state.settings).toEqual([]);
  await page.getByLabel("Quiet hours end", { exact: true }).fill("08:00");
  await page.getByLabel("Quiet hours timezone", { exact: true }).fill("Africa/Nairobi");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Email preferences saved", { exact: true })).toBeVisible();
  expect(state.settings[0]).toMatchObject({ quietHoursStart: "22:00", quietHoursEnd: "08:00", timezone: "Africa/Nairobi" });
});

test("global email opt-out is shown separately and disables the chat-specific control", async ({ page, context }) => {
  await setup(page, context, { globalEmail: false });
  await page.getByRole("button", { name: "Chat email notifications" }).click();
  await expect(page.getByRole("checkbox", { name: "Allow email notifications for my account", exact: false })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Email me about unread team chat", exact: false })).toBeDisabled();
});
