import { quietHoursResumeAt } from "./chat-email-policy";

describe("Chat email quiet hours", () => {
  it("resumes overnight quiet hours at the recipient's local morning", () => {
    expect(quietHoursResumeAt({ quietHoursStart: "22:00", quietHoursEnd: "08:00", timezone: "Africa/Nairobi" }, new Date("2026-11-26T20:00:00Z"))).toEqual(new Date("2026-11-27T05:00:00Z"));
  });
  it("respects daylight saving transitions and leaves daytime unrestricted", () => {
    expect(quietHoursResumeAt({ quietHoursStart: "22:00", quietHoursEnd: "08:00", timezone: "America/New_York" }, new Date("2026-03-08T06:00:00Z"))).toEqual(new Date("2026-03-08T12:00:00Z"));
    expect(quietHoursResumeAt({ quietHoursStart: "22:00", quietHoursEnd: "08:00", timezone: "UTC" }, new Date("2026-11-26T12:00:00Z"))).toBeNull();
  });
  it("defers invalid settings safely and accepts disabled quiet hours", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(quietHoursResumeAt({ quietHoursStart: "wrong", quietHoursEnd: "08:00" }, now)).toEqual(new Date("2026-11-26T13:00:00Z"));
    expect(quietHoursResumeAt({ quietHoursStart: "22:00", quietHoursEnd: "08:00", timezone: "Bad/Timezone" }, now)).toEqual(new Date("2026-11-26T13:00:00Z"));
    expect(quietHoursResumeAt({}, now)).toBeNull();
  });
});
