/** Accept both structured API errors and raw Axios errors (session renewal). */
export function rateLimitRetrySeconds(error: unknown): number | null {
  const value = error as { statusCode?: number; retryAfterSeconds?: number; response?: { status?: number; data?: { retryAfterSeconds?: number }; headers?: Record<string, unknown> } } | null;
  if ((value?.statusCode ?? value?.response?.status) !== 429) return null;
  const supplied = value?.retryAfterSeconds ?? value?.response?.data?.retryAfterSeconds ?? value?.response?.headers?.["retry-after"];
  const number = Number(supplied);
  if (Number.isFinite(number) && number > 0) return Math.min(86400, Math.ceil(number));
  const date = typeof supplied === "string" ? Date.parse(supplied) : NaN;
  return Number.isFinite(date) && date > Date.now() ? Math.min(86400, Math.ceil((date - Date.now()) / 1000)) : 60;
}

export function rateLimitMessage(seconds: number): string {
  return `Too many requests. Please wait ${seconds} seconds before trying again.`;
}

export function rateLimitError(error: unknown): (Error & { statusCode: number; retryAfterSeconds: number }) | null {
  const seconds = rateLimitRetrySeconds(error);
  return seconds === null ? null : Object.assign(new Error(rateLimitMessage(seconds)), { statusCode: 429, retryAfterSeconds: seconds });
}
