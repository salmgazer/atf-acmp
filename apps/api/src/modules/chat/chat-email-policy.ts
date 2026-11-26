import { DateTime } from "luxon";

export const CHAT_EMAIL_DELAY_MS = 5 * 60_000;
export const CHAT_EMAIL_COOLDOWN_MS = 60 * 60_000;
export const CHAT_EMAIL_MAX_ATTEMPTS = 5;

/** Quiet hours defer delivery and use the recipient's timezone, including DST. */
export function quietHoursResumeAt(preferences: { quietHoursStart?: string; quietHoursEnd?: string; timezone?: string }, now: Date): Date | null {
  const { quietHoursStart: start, quietHoursEnd: end } = preferences;
  if (!start && !end) return null;
  const validTime = (time?: string) => !!time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  // Invalid stored settings must not cause an unwanted email during quiet hours.
  const retry = () => new Date(now.getTime() + CHAT_EMAIL_COOLDOWN_MS);
  if (!validTime(start) || !validTime(end)) return retry();
  const local = DateTime.fromJSDate(now).setZone(preferences.timezone || "UTC");
  if (!local.isValid) return retry();
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const first = minutes(start!), last = minutes(end!), current = local.hour * 60 + local.minute;
  const quiet = first > last ? current >= first || current < last : current >= first && current < last;
  if (!quiet) return null;
  let resume = local.startOf("day").set({ hour: Math.floor(last / 60), minute: last % 60 });
  if (resume <= local) resume = resume.plus({ days: 1 });
  return resume.toJSDate();
}
