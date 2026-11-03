import { ConfigService } from "@nestjs/config";
import { ZoomService } from "./zoom.service";

describe("Shared ATF Zoom meetings", () => {
  const config = new ConfigService({ ZOOM_ACCOUNT_ID: "account", ZOOM_CLIENT_ID: "client", ZOOM_CLIENT_SECRET: "secret", ZOOM_HOST_USER_ID: "host@example.test" });
  const input = { title: "Brief discussion", description: "Review participant questions", startAt: new Date("2030-06-01T10:00:00Z"), durationMinutes: 60, timezone: "Africa/Accra" };
  const fetchMock = jest.spyOn(global, "fetch");
  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

  it("creates a scheduled meeting in the explicit shared host account and returns only participant details", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "access", expires_in: 3600 })).mockResolvedValueOnce(json({ id: 12345678901, join_url: "https://zoom.us/j/12345678901", start_url: "host-only-secret" }, 201));
    const meeting = await new ZoomService(config).createMeeting(input);
    expect(meeting).toEqual({ id: "12345678901", joinUrl: "https://zoom.us/j/12345678901" });
    expect(fetchMock.mock.calls[0][1]?.body?.toString()).toContain("grant_type=account_credentials");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.zoom.us/v2/users/host%40example.test/meetings");
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toMatchObject({ type: 2, agenda: input.description, start_time: input.startAt.toISOString(), settings: { waiting_room: true, join_before_host: false } });
  });
  it("reuses the access token for updates and treats already-deleted meetings as cancelled", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "access", expires_in: 3600 })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({}, 404));
    const zoom = new ZoomService(config);
    await zoom.updateMeeting("123", input);
    await expect(zoom.deleteMeeting("123")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  });
  it("refreshes an expired token after HTTP 401 without exposing credentials", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "old", expires_in: 3600 })).mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: "new", expires_in: 3600 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await new ZoomService(config).updateMeeting("123", input);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({ Authorization: "Bearer new" });
  });
  it("fails clearly without configuration and never sends an external request", async () => {
    const zoom = new ZoomService(new ConfigService());
    expect(zoom.isReady()).toBe(false);
    await expect(zoom.createMeeting(input)).rejects.toThrow("shared ATF Zoom account");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns an actionable provider error without leaking the token or response", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "access-secret", expires_in: 3600 })).mockResolvedValueOnce(json({ message: "sensitive provider detail" }, 429));
    await expect(new ZoomService(config).createMeeting(input)).rejects.toThrow("Zoom could not complete");
  });
  it("fetches a fresh host link and rejects non-Zoom host URLs", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "access", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ start_url: "https://zoom.us/s/123?zak=secret" }))
      .mockResolvedValueOnce(json({ start_url: "https://unrelated.example.test/host" }));
    const zoom = new ZoomService(config);
    await expect(zoom.getHostUrl("123")).resolves.toBe("https://zoom.us/s/123?zak=secret");
    await expect(zoom.getHostUrl("123")).rejects.toThrow("invalid host link");
  });
});
