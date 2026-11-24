import { lookup } from "dns/promises";
import { request } from "https";

export class WarmupEvidenceError extends Error {}

/** Only globally routed IPv4 addresses; pin the checked address to defeat DNS rebinding. */
export function isPublicDeploymentAddress(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113));
}
export function deploymentUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") throw new WarmupEvidenceError("Use a public HTTPS deployment on port 443");
  return url;
}
export async function inspectWarmupDeployment(value: string, redirects = 0): Promise<{ url: string; html: string }> {
  if (redirects > 3) throw new WarmupEvidenceError("Too many deployment redirects");
  const url = deploymentUrl(value);
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error("Deployment DNS lookup timed out")), 5000); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(a => !isPublicDeploymentAddress(a.address))) throw new WarmupEvidenceError("The deployment must resolve to public internet addresses");
  const response = await new Promise<{ status: number; location?: string; type: string; body: string }>((resolve, reject) => {
    const req = request(url, { method: "GET", family: 4, lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4), headers: { Accept: "text/html", "Accept-Encoding": "identity", "User-Agent": "ACMP-Warmup-Evaluator/1.0" } }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 512 * 1024) { req.destroy(new Error("Deployment response exceeds 512 KB")); return; } chunks.push(chunk); });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode || 0, location: res.headers.location, type: res.headers["content-type"] || "", body: Buffer.concat(chunks).toString("utf8") }));
    });
    const timer = setTimeout(() => req.destroy(new Error("Deployment did not respond within 15 seconds")), 15000);
    req.on("close", () => clearTimeout(timer)); req.on("error", reject); req.end();
  });
  if ([301, 302, 303, 307, 308].includes(response.status) && response.location) return inspectWarmupDeployment(new URL(response.location, url).toString(), redirects + 1);
  if (response.status !== 200 || !/^text\/html\b/i.test(response.type) || !/<(?:html|body|div|main)\b/i.test(response.body)) throw new WarmupEvidenceError("The deployment must serve a publicly accessible HTML web app (HTTP 200)");
  return { url: url.toString(), html: response.body.slice(0, 30000) };
}
