import { EmailService } from "./email.service";
import * as nodemailer from "nodemailer";
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("Builder broadcast emails", () => {
  const params = { to: "builder@example.test", firstName: "Sam <b>Builder</b>", subject: "Team update <script>", message: "Hello <img src=x>\nPlease confirm your profile." };
  const config = (values: Record<string, string> = {}) => ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as any;
  it("sends an individually addressed branded email with escaped message content and plain text", async () => {
    const sendMail = jest.fn(async (_mail: { html: string }) => ({}));
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    await new EmailService(config({ SMTP_HOST: "mailpit", FRONTEND_URL: "https://portal.example.test" })).sendBuilderBroadcastEmail(params);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: params.to, subject: params.subject, html: expect.stringContaining("/logos/email-logo.png"), text: expect.stringContaining(params.message) }));
    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain("&lt;img src=x&gt;<br />"); expect(html).not.toContain("<script>"); expect(html).not.toContain("<b>Builder</b>");
  });
  it("fails visibly rather than claiming delivery when no provider is configured", async () => {
    await expect(new EmailService(config()).sendBuilderBroadcastEmail(params)).rejects.toThrow("not configured");
  });
});
