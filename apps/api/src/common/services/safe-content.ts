import sanitizeHtml from "sanitize-html";

const SECRET_FIELDS = /^(password|passwordHash|passwordResetToken|passwordResetExpires|token|refreshToken|accessToken|secret|apiKey|privateKey)$/i;
const HTML_FIELDS = /^(description|problemStatement|expectedOutcomes|content|body|whatChanges|instructions|feedback|notes|value)$/i;

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "code", "a", "hr"],
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}

export function sanitizeRichContent(value: any, rich = false): any {
  if (typeof value === "string") return rich ? sanitizeRichText(value) : value;
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(item => sanitizeRichContent(item, rich));
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["__proto__", "constructor", "prototype"].includes(key))
    .map(([key, item]) => [key, sanitizeRichContent(item, HTML_FIELDS.test(key))]));
}

/** Strip credentials at every nesting level; only auth responses may issue tokens. */
export function redactSensitive(value: any, allowSessionTokens = false, depth = 0): any {
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(item => redactSensitive(item, false, depth + 1));
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SECRET_FIELDS.test(key.replace(/[_-]/g, "")) || (allowSessionTokens && depth === 0 && ["accessToken", "refreshToken"].includes(key)))
    .map(([key, item]) => [key, redactSensitive(item, false, depth + 1)]));
}
