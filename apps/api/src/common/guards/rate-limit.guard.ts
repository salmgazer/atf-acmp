import { ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { ThrottlerException, ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest, ThrottlerOptions } from "@nestjs/throttler";
import { createHash } from "crypto";
import { Request } from "express";

export const AUTH_RATE_LIMIT = "acmp:auth-rate-limit";
export const DEFAULT_RATE_LIMITS: ThrottlerOptions[] = [
  { name: "short", ttl: 1000, limit: 10 },
  { name: "medium", ttl: 60000, limit: 100 },
  { name: "long", ttl: 3600000, limit: 1000 },
];
// These are additional network ceilings; strict per-account limits remain unchanged.
const NETWORK_LIMITS: Record<string, number> = { short: 30, medium: 600, long: 6000 };
type RateRequest = Request & { user?: { id: string; role?: string } };
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");

class RateLimitException extends ThrottlerException {
  constructor(private readonly retryAfterSeconds: number) {
    super(`Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`);
  }
  getResponse() { return { statusCode: 429, message: this.message, retryAfterSeconds: this.retryAfterSeconds }; }
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly logger = new Logger(RateLimitGuard.name);

  protected async getTracker(req: RateRequest): Promise<string> {
    if (req.user?.id) return `user:${req.user.role || "account"}:${req.user.id}`;
    return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
  }

  private authTracker(req: RateRequest): Promise<string> | string {
    if (req.user?.id) return this.getTracker(req);
    if (typeof req.body?.email === "string" && req.body.email.trim()) return `account:${fingerprint(req.body.email.trim().toLowerCase())}`;
    const cookie = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("acmp_refresh="));
    // Never store credentials in counters or logs. Different refresh sessions must
    // not share the carrier/campus NAT's small authentication allowance.
    let credential = cookie ? cookie.slice("acmp_refresh=".length) : req.body?.refreshToken || req.body?.token || req.body?.idToken;
    if (cookie) try { credential = decodeURIComponent(credential); } catch { /* Invalid cookies still face the network limit. */ }
    if (typeof credential === "string" && credential) return `credential:${fingerprint(credential)}`;
    return this.getTracker(req);
  }

  protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const sensitive = this.reflector.getAllAndOverride<boolean>(AUTH_RATE_LIMIT, [props.context.getHandler(), props.context.getClass()]);
    if (!sensitive) return super.handleRequest(props);
    const req = props.context.switchToHttp().getRequest<RateRequest>();
    if (!req.user?.id) {
      await super.handleRequest({ ...props, limit: NETWORK_LIMITS[props.throttler.name || ""] || props.limit,
        getTracker: () => `network:${req.ip || req.socket.remoteAddress || "unknown"}` });
    }
    return super.handleRequest({ ...props, getTracker: () => this.authTracker(req) });
  }

  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire || detail.timeToExpire));
    res.header("Retry-After", String(seconds));
    res.header("Cache-Control", "no-store");
    const scope = detail.tracker.split(":", 1)[0];
    // Route names and scope only: no email, password, token, participant ID or IP.
    this.logger.warn(`Rate limited ${context.getClass().name}.${context.getHandler().name} scope=${scope} limit=${detail.limit} ttlMs=${detail.ttl} retryAfterSeconds=${seconds}`);
    throw new RateLimitException(seconds);
  }
}
