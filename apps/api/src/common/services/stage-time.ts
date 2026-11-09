import { BadRequestException } from "@nestjs/common";
/** Stage editor wall-clock values are UTC, including offset-free API input. */
export function parseStageTimestamp(value: string): Date {
  const zoned = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(zoned);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException("Stage dates must be valid ISO timestamps");
  return date;
}
