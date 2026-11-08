/** Stable UTC deadline display, independent of the browser/server timezone. */
export function formatUtcDeadline(value?: string | Date | null): string {
  if (!value) return "Not configured";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not configured";
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
