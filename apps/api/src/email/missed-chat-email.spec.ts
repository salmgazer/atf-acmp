import { EmailService } from "./email.service";
import * as nodemailer from "nodemailer";
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("Missed chat email delivery", () => {
  const params = { to: "recipient@example.test", firstName: "Example <script>", teamName: "Team <img src=x>", chatUrl: "https://portal.example.test/participant/chat?channelId=channel", preferencesUrl: "https://portal.example.test/participant/chat?channelId=channel&emailSettings=1", deliveryId: "test-delivery" };
  const config = (values: Record<string, string>) => ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as any;
  it("uses a branded individual email, stable conversation link and Resend idempotency key without copying chat text", async () => {
    const service = new EmailService(config({ FRONTEND_URL: "https://portal.example.test" }));
    const send = jest.fn(async () => ({ data: { id: "provider-id" }, error: null }));
    (service as any).resendClient = { emails: { send } };
    await service.sendMissedChatEmail(params);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: [params.to], html: expect.stringContaining("/logos/email-logo.png"), text: expect.stringContaining(params.preferencesUrl) }), { idempotencyKey: "team-chat/test-delivery" });
    const message = (send.mock.calls[0] as any)[0];
    expect(message.html).toContain("&lt;script&gt;"); expect(message.html).not.toContain("<img src=x>");
    expect(message.html).toContain("Open team chat"); expect(message.html).toContain("Manage chat email notifications");
    expect(message.attachments).toBeUndefined();
  });
  it("does not duplicate an uncertain Resend request through another provider", async () => {
    const sendMail = jest.fn(async () => ({})); jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
    const service = new EmailService(config({ SMTP_HOST: "mailpit" }));
    (service as any).resendClient = { emails: { send: jest.fn(async () => { throw new Error("Provider response timed out"); }) } };
    await expect(service.sendMissedChatEmail(params)).rejects.toThrow("timed out");
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("fails when no delivery provider is configured", async () => {
    await expect(new EmailService(config({})).sendMissedChatEmail(params)).rejects.toThrow("not configured");
  });
});
