import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "@/email/email.service";
import { calendarInvitation } from "./calendar-invitation";

describe("Brief event calendar invitations", () => {
  const input = { eventId: "event-uuid", sequence: 0, title: "Brief discussion", description: "Discuss; questions, answers\nNext topic", startAt: new Date("2030-06-01T12:00:00+02:00"), endAt: new Date("2030-06-01T13:00:00+02:00"), joinUrl: "https://zoom.us/j/123", organizer: "atf@example.test", attendee: "person@example.test", cancelled: false, updatedAt: new Date("2030-05-01T00:00:00Z") };
  it("uses UTC times, stable UIDs and increasing sequence numbers for updates and cancellation", () => {
    const first = calendarInvitation(input);
    const updated = calendarInvitation({ ...input, sequence: 1, cancelled: true });
    expect(first.method).toBe("REQUEST");
    expect(first.content).toContain("DTSTART:20300601T100000Z");
    expect(first.content).toContain("Discuss\\; questions\\, answers\\nNext topic");
    expect(updated.content).toContain("UID:brief-event-event-uuid@acmp.atf.africa");
    expect(updated.content).toContain("SEQUENCE:1");
    expect(updated.content).toContain("METHOD:CANCEL");
    expect(updated.content).toContain("STATUS:CANCELLED");
  });
  it("folds UTF-8 lines at 75 bytes and prevents property injection", () => {
    const content = calendarInvitation({ ...input, description: "é".repeat(100) + "\r\nATTENDEE:mailto:evil@example.test" }).content;
    expect(content.split("\r\n").every(line => Buffer.byteLength(line) <= 75)).toBe(true);
    expect(content).not.toContain("\r\nATTENDEE:mailto:evil");
    expect(() => calendarInvitation({ ...input, attendee: "a@example.test\r\nATTENDEE:evil" })).toThrow();
  });
  it("sends a real SMTP MIME calendar invitation with the original Zoom URL", async () => {
    const email = new EmailService(new ConfigService());
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const send = jest.spyOn(transport, "sendMail");
    (email as any).smtpTransporter = transport;
    await email.sendCalendarInvitation(input.attendee, input.title, "<p>Join the event</p>", "Join the event", calendarInvitation(input));
    const sent = await send.mock.results[0].value;
    expect(sent.message.toString()).toContain("text/calendar");
    expect(sent.message.toString()).toContain("method=REQUEST");
    expect(sent.message.toString()).toContain("UID:brief-event-event-uuid@acmp.atf.africa");
  });
  it("keeps invitations pending when no email provider is configured", async () => {
    await expect(new EmailService(new ConfigService()).sendCalendarInvitation(input.attendee, input.title, "html", "text", calendarInvitation(input))).rejects.toThrow("not configured");
  });
  it("preserves the calendar attachment through Resend and falls back to SMTP on rejection", async () => {
    const email = new EmailService(new ConfigService());
    const send = jest.fn().mockResolvedValue({ data: { id: "sent" }, error: null });
    (email as any).resendClient = { emails: { send } };
    const calendar = calendarInvitation(input);
    await email.sendCalendarInvitation(input.attendee, input.title, "html", "text", calendar);
    const attachment = send.mock.calls[0][0].attachments[0];
    expect(attachment.contentType).toContain("method=REQUEST");
    expect(Buffer.from(attachment.content, "base64").toString()).toBe(calendar.content);
    send.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
    const smtp = { sendMail: jest.fn().mockResolvedValue({}) };
    (email as any).smtpTransporter = smtp;
    await email.sendCalendarInvitation(input.attendee, input.title, "html", "text", calendar);
    expect(smtp.sendMail.mock.calls[0][0].icalEvent.content).toBe(calendar.content);
  });
  it("includes calendar attachments in Mandrill and treats a rejected recipient as delivery failure", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ status: "rejected" }]), { status: 200 }));
    try {
      const email = new EmailService(new ConfigService({ email: { mailchimpApiKey: "test-key" } }));
      const calendar = calendarInvitation({ ...input, cancelled: true, sequence: 1 });
      await expect(email.sendCalendarInvitation(input.attendee, input.title, "html", "text", calendar)).rejects.toThrow("rejected");
      const request = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(request.message.attachments[0].type).toContain("method=CANCEL");
      expect(Buffer.from(request.message.attachments[0].content, "base64").toString()).toBe(calendar.content);
    } finally { fetchMock.mockRestore(); }
  });
});
