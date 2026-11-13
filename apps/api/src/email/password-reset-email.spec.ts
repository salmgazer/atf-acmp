import { EmailService } from "./email.service";
import * as nodemailer from "nodemailer";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("Password reset delivery", () => {
  const params = { to: "participant@example.test", token: "test-token", firstName: "Learner <script>bad()</script>", portal: "participant" };
  const service = (values: Record<string, unknown> = {}) => new EmailService({ get: (key: string, fallback?: unknown) => values[key] ?? fallback } as any);

  it("includes the public reset link and plain text, normalizes the URL and escapes participant names", async () => {
    const sendMail = jest.fn(async () => ({}));
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    await service({ SMTP_HOST: "test-smtp", FRONTEND_URL: "https://build.example.test/" }).sendPasswordResetLink(params);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: params.to, subject: "Reset Your ATF Password", html: expect.stringContaining('href="https://build.example.test/participant/reset-password?token=test-token"'), text: expect.stringContaining("https://build.example.test/participant/reset-password?token=test-token") }));
    const mail = (sendMail.mock.calls[0] as unknown as [{ html: string }])[0];
    expect(mail.html).toContain("&lt;script&gt;"); expect(mail.html).not.toContain("<script>");
  });
  it("fails when no delivery provider is configured instead of logging a reset token", async () => {
    await expect(service().sendPasswordResetLink(params)).rejects.toThrow("not configured");
  });
  it("does not silently accept a Resend rejection when there is no fallback provider", async () => {
    const email = service();
    (email as any).resendClient = { emails: { send: jest.fn(async () => ({ data: null, error: { message: "Rejected", name: "validation_error" } })) } };
    await expect(email.sendPasswordResetLink(params)).rejects.toThrow("not configured");
  });
  it("rejects a Mailchimp recipient rejection even when the HTTP response succeeds", async () => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => [{ status: "rejected" }] } as any);
    try { await expect(service({ "email.mailchimpApiKey": "test-only-key" }).sendPasswordResetLink(params)).rejects.toThrow("rejected by the provider"); }
    finally { fetch.mockRestore(); }
  });
});
