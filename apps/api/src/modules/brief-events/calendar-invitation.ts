export interface CalendarInvitationInput {
  eventId: string;
  sequence: number;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  joinUrl: string;
  organizer: string;
  attendee: string;
  cancelled: boolean;
  updatedAt: Date;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function foldLine(line: string): string {
  const lines: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const length = Buffer.byteLength(character);
    if (bytes + length > 75) { lines.push(current); current = " "; bytes = 1; }
    current += character;
    bytes += length;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function calendarInvitation(input: CalendarInvitationInput): { method: "REQUEST" | "CANCEL"; content: string } {
  if ([input.organizer, input.attendee].some(value => /[\r\n]/.test(value))) throw new Error("Invalid calendar email address");
  const method = input.cancelled ? "CANCEL" : "REQUEST";
  const timestamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ATF//ACMP Brief Events//EN", "CALSCALE:GREGORIAN", `METHOD:${method}`, "BEGIN:VEVENT",
    `UID:brief-event-${input.eventId}@acmp.atf.africa`, `SEQUENCE:${input.sequence}`, `DTSTAMP:${timestamp(input.updatedAt)}`,
    `DTSTART:${timestamp(input.startAt)}`, `DTEND:${timestamp(input.endAt)}`, `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description + "\n\nJoin Zoom: " + input.joinUrl)}`, `LOCATION:${escapeText(input.joinUrl)}`,
    `ORGANIZER:mailto:${input.organizer}`, `ATTENDEE;RSVP=TRUE:mailto:${input.attendee}`, `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR"];
  return { method, content: lines.map(foldLine).join("\r\n") + "\r\n" };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
