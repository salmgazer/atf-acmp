import "reflect-metadata";
import { Body, Controller, Get, INestApplication, Logger, Post, Req } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Throttle, ThrottlerModule } from "@nestjs/throttler";
import { Request } from "express";
import { AddressInfo } from "net";
import { configureProxy } from "@/common/configure-proxy";
import { AuthThrottle, NoThrottle, StrictThrottle } from "@/common/decorators/throttle.decorator";
import { DEFAULT_RATE_LIMITS, RateLimitGuard } from "@/common/guards/rate-limit.guard";
import { GlobalExceptionFilter } from "@/common/filters/http-exception.filter";

@Controller("probe")
class ProbeController {
  @Get("profile") profile(@Req() req: Request) { return { ip: req.ip }; }
  @Post("login") @Throttle({ short: { limit: 1000 } }) @AuthThrottle()
  login(@Body() _body: unknown) { return { ok: true }; }
  @Post("hour") @Throttle({ short: { limit: 1000 }, medium: { limit: 1000 } }) @AuthThrottle()
  hour() { return { ok: true }; }
  @Post("password") @Throttle({ short: { limit: 1000 } }) @AuthThrottle()
  password() { return { ok: true }; }
  @Post("refresh") @Throttle({ short: { limit: 1000 } }) @AuthThrottle()
  refresh() { return { ok: true }; }
  @Post("burst") @AuthThrottle() burst() { return { ok: true }; }
  @Post("network") @Throttle({ short: { ttl: 60000 } }) @AuthThrottle()
  network() { return { ok: true }; }
  @Post("strict") @Throttle({ short: { limit: 1000 } }) @StrictThrottle()
  strict() { return { ok: true }; }
  @Get("health") @NoThrottle() health() { return { ok: true }; }
}

describe("Proxy-aware rate limiting over HTTP", () => {
  let app: INestApplication, base: string;
  let warnings: jest.SpyInstance;
  beforeAll(() => { warnings = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined); });
  afterAll(() => warnings.mockRestore());
  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [ThrottlerModule.forRoot(DEFAULT_RATE_LIMITS)], controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }] }).compile();
    app = module.createNestApplication({ logger: false });
    configureProxy(app, new ConfigService({ NODE_ENV: "test", TRUST_PROXY_CIDRS: "127.0.0.1/32" }));
    // Simulates ONLY the verified principal normally populated by JwtAuthGuard.
    app.use((req: any, _res: unknown, next: () => void) => { if (req.headers["x-test-principal"]) req.user = { id: req.headers["x-test-principal"], role: "participant" }; next(); });
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.listen(0, "127.0.0.1"); base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/probe`;
  });
  afterEach(async () => { await app.close(); warnings.mockClear(); });
  const post = (route: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.1", ...headers }, body: JSON.stringify(body) });

  it("uses the nearest forwarded client behind the trusted ALB, ignoring attacker-prepended IPs", async () => {
    const response = await fetch(base + "/profile", { headers: { "X-Forwarded-For": "192.0.2.99, 198.51.100.5" } });
    expect(await response.json()).toEqual({ ip: "198.51.100.5" });
  });
  it("ignores forwarded IPs from an untrusted direct peer", async () => {
    configureProxy(app, new ConfigService({ NODE_ENV: "test", TRUST_PROXY_CIDRS: "10.0.0.0/24" }));
    const response = await fetch(base + "/profile", { headers: { "X-Forwarded-For": "198.51.100.5" } });
    expect(await response.json()).toEqual({ ip: "127.0.0.1" });
  });
  it("trusts only hop zero within an explicitly approved ALB subnet, including mapped IPv4", () => {
    configureProxy(app, new ConfigService({ NODE_ENV: "test", TRUST_PROXY_CIDRS: "172.31.0.0/20" }));
    const trust = app.getHttpAdapter().getInstance().get("trust proxy fn");
    expect(trust("172.31.1.5", 0)).toBe(true);
    expect(trust("::ffff:172.31.1.5", 0)).toBe(true);
    expect(trust("172.31.1.5", 1)).toBe(false);
    expect(trust("198.51.100.5", 0)).toBe(false);
  });
  it("allows different participants sharing a campus/carrier IP to sign in independently", async () => {
    const statuses = [];
    for (let index = 0; index < 8; index++) statuses.push((await post("/login", { email: `participant-${index}@example.test` })).status);
    expect(statuses).toEqual(Array(8).fill(201));
  });
  it("keeps account limits across changing IPs, portal values and email casing, without logging personal data", async () => {
    for (let index = 0; index < 5; index++) expect((await post("/login", { email: index % 2 ? "ALICE@example.test" : "alice@example.test", portal: index % 2 ? "staff" : "participant" }, { "X-Forwarded-For": `198.51.100.${index + 1}` })).status).toBe(201);
    const response = await post("/login", { email: "alice@example.test", user: { id: "forged" } });
    expect(response.status).toBe(429);
    const body = await response.json() as { message: string; retryAfterSeconds: number };
    expect(body.retryAfterSeconds).toBeGreaterThan(0); expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(Number(response.headers.get("Retry-After"))).toBe(body.retryAfterSeconds);
    expect(body.message).toContain("Please wait");
    const logged = JSON.stringify(warnings.mock.calls);
    expect(logged).toContain("scope=account"); expect(logged).not.toMatch(/alice|198\.51\.100|forged/);
  });
  it("keeps authentication burst and stricter recovery protections", async () => {
    for (let index = 0; index < 3; index++) expect((await post("/burst", { email: "burst@example.test" })).status).toBe(201);
    expect((await post("/burst", { email: "burst@example.test" })).status).toBe(429);
    for (let index = 0; index < 3; index++) expect((await post("/strict", { email: "recovery@example.test" })).status).toBe(201);
    expect((await post("/strict", { email: "recovery@example.test" })).status).toBe(429);
  });
  it("retains the twenty-per-hour account ceiling and returns its full retry duration", async () => {
    for (let index = 0; index < 20; index++) expect((await post("/hour", { email: "hourly@example.test" })).status).toBe(201);
    const response = await post("/hour", { email: "hourly@example.test" });
    expect(response.status).toBe(429);
    expect((await response.json() as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(3500);
  });
  it("retains a network ceiling even if an attacker rotates email addresses", async () => {
    for (let index = 0; index < 30; index++) expect((await post("/network", { email: `rotating-${index}@example.test` })).status).toBe(201);
    expect((await post("/network", { email: "another@example.test" })).status).toBe(429);
    expect(JSON.stringify(warnings.mock.calls)).toContain("scope=network");
  });
  it("keys signed-in API access by verified participant, not the shared IP or a body field", async () => {
    for (let index = 0; index < 10; index++) expect((await fetch(base + "/profile", { headers: { "x-test-principal": "participant-a" } })).status).toBe(200);
    expect((await fetch(base + "/profile", { headers: { "x-test-principal": "participant-a" } })).status).toBe(429);
    expect((await fetch(base + "/profile", { headers: { "x-test-principal": "participant-b" } })).status).toBe(200);
  });
  it("keeps password-change limits per verified account across IPs and isolates other participants", async () => {
    for (let index = 0; index < 5; index++) expect((await post("/password", { email: `untrusted-${index}@example.test` }, { "x-test-principal": "account-a", "X-Forwarded-For": `198.51.100.${index + 1}` })).status).toBe(201);
    expect((await post("/password", {}, { "x-test-principal": "account-a" })).status).toBe(429);
    expect((await post("/password", {}, { "x-test-principal": "account-b" })).status).toBe(201);
  });
  it("isolates refresh sessions behind one NAT and never logs their credentials", async () => {
    for (let index = 0; index < 5; index++) expect((await post("/refresh", {}, { Cookie: "acmp_refresh=private-refresh-one" })).status).toBe(201);
    expect((await post("/refresh", {}, { Cookie: "acmp_refresh=private-refresh-one" })).status).toBe(429);
    expect((await post("/refresh", {}, { Cookie: "acmp_refresh=private-refresh-two" })).status).toBe(201);
    expect(JSON.stringify(warnings.mock.calls)).not.toContain("private-refresh");
  });
  it("exempts every named limiter from health checks", async () => {
    for (let index = 0; index < 20; index++) expect((await fetch(base + "/health")).status).toBe(200);
  });
  it.each(["true", "1", "*", "0.0.0.0/0", "::/0", "10.0.0.0/33", "invalid"])("rejects unsafe/invalid proxy configuration %s", value => {
    expect(() => configureProxy(app, new ConfigService({ NODE_ENV: "production", TRUST_PROXY_CIDRS: value }))).toThrow("TRUST_PROXY_CIDRS");
  });
  it("fails closed when production has no configured trusted proxy", () => {
    expect(() => configureProxy(app, new ConfigService({ NODE_ENV: "production", TRUST_PROXY_CIDRS: "" }))).toThrow("TRUST_PROXY_CIDRS");
  });
});
