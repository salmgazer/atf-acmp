import { EmailService } from "./email.service";
import * as nodemailer from "nodemailer";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("Participant invitation email", () => {
  const invite = { to: "participant@example.test", firstName: "Jane <script>bad()</script>", participantId: "ATF-001", portalUrl: "https://portal.example.test/participant/login" };
  function service(values: Record<string, unknown>) {
    return new EmailService({ get: (key: string, fallback?: unknown) => values[key] ?? fallback } as any);
  }

  it("uses the welcome logo, escapes names and includes plain-text login instructions", async () => {
    const sendMail = jest.fn(async (_mail: { html: string }) => ({}));
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    const email = service({ SMTP_HOST: "mailpit", FRONTEND_URL: "https://portal.example.test" });
    await email.sendParticipantInviteEmail(invite);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: invite.to,
      subject: "Your invitation to ATF AI Challenge",
      html: expect.stringContaining("/logos/email-logo.png"),
      text: expect.stringContaining("Your Participant ID: ATF-001"),
    }));
    expect(sendMail.mock.calls[0][0].html).toContain("&lt;script&gt;");
    expect(sendMail.mock.calls[0][0].html).not.toContain("<script>");
  });

  it("rejects missing configuration and failed delivery instead of reporting an email was sent", async () => {
    expect(() => service({}).requireDeliveryConfiguration()).toThrow("not configured");
    const sendMail = jest.fn(async () => { throw new Error("SMTP unavailable"); });
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    await expect(service({ SMTP_HOST: "mailpit" }).sendParticipantInviteEmail(invite)).rejects.toThrow("not configured");
  });

  it("treats provider rejection as a failed invitation", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => [{ status: "rejected" }] })) as any;
    try {
      await expect(service({ "email.mailchimpApiKey": "test-only-key" }).sendParticipantInviteEmail(invite)).rejects.toThrow("rejected by the provider");
    } finally { global.fetch = originalFetch; }
  });

  it("resends the branded mentor invitation with current login instructions", async () => {
    const sendMail = jest.fn(async (_mail: { html: string; text: string }) => ({}));
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    await expect(service({ SMTP_HOST: "mailpit" }).sendMentorWelcomeEmail({ to: "corrected@example.test", firstName: "Mentor <script>bad()</script>", lastName: "Test", cohortName: "Research & AI", portalUrl: "https://portal.example.test" }, true)).resolves.toBe(true);
    expect(sendMail.mock.calls[0][0].html).toContain("/logos/email-logo.png");
    expect(sendMail.mock.calls[0][0].html).toContain("https://portal.example.test/mentor/login");
    expect(sendMail.mock.calls[0][0].html).not.toContain("<script>");
    expect(sendMail.mock.calls[0][0].text).toContain("corrected@example.test");
  });

  it("does not report successful mentor resends if configuration or delivery is missing", async () => {
    const params = { to: "mentor@example.test", firstName: "Mentor", lastName: "Test", portalUrl: "https://portal.example.test" };
    await expect(service({}).sendMentorWelcomeEmail(params, true)).rejects.toThrow("not configured");
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: jest.fn(async () => { throw new Error("SMTP failed"); }) } as any);
    await expect(service({ SMTP_HOST: "mailpit" }).sendMentorWelcomeEmail(params, true)).rejects.toThrow("Could not send the mentor invitation");
  });
  it("sends branded partner resends with safe content and the organization login URL", async () => {
    const sendMail = jest.fn(async (_mail: { html: string; text: string }) => ({}));
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    await expect(service({ SMTP_HOST: "mailpit", FRONTEND_URL: "https://portal.example.test/" }).sendOrganizationInvite("Partner <script>bad()</script>", "partner@example.test", "Welcome <b>team</b>", true)).resolves.toBe(true);
    expect(sendMail.mock.calls[0][0].html).toContain("/logos/email-logo.png");
    expect(sendMail.mock.calls[0][0].html).toContain('href="https://portal.example.test/partners/login"');
    expect(sendMail.mock.calls[0][0].html).not.toContain("<script>");
    expect(sendMail.mock.calls[0][0].html).toContain("Welcome &lt;b&gt;team&lt;/b&gt;");
    expect(sendMail.mock.calls[0][0].text).toContain("partner@example.test");
  });
  it("does not report successful partner resends when configuration or delivery is missing", async () => {
    await expect(service({}).sendOrganizationInvite("Partner", "partner@example.test", undefined, true)).rejects.toThrow("not configured");
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: jest.fn(async () => { throw new Error("SMTP failed"); }) } as any);
    await expect(service({ SMTP_HOST: "mailpit" }).sendOrganizationInvite("Partner", "partner@example.test", undefined, true)).rejects.toThrow("Could not send the partner invitation");
  });

});
