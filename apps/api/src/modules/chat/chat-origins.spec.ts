import "reflect-metadata";
import { GATEWAY_OPTIONS } from "@nestjs/websockets/constants";

describe("Chat gateway origin permissions", () => {
  const originalCors = process.env.CORS_ORIGINS;
  const originalFrontend = process.env.FRONTEND_URL;
  afterEach(() => {
    if (originalCors === undefined) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = originalCors;
    if (originalFrontend === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = originalFrontend;
    jest.resetModules();
  });

  async function options(cors?: string, frontend?: string) {
    if (cors === undefined) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = cors;
    if (frontend === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = frontend;
    jest.resetModules();
    const { ChatGateway } = await import("./chat.gateway");
    return Reflect.getMetadata(GATEWAY_OPTIONS, ChatGateway);
  }

  it("allows the new production portal and existing aliases without allowing arbitrary origins", async () => {
    const gateway = await options("https://app.atfchallenge.org, https://built.atfchallenge.org, https://build.atfchallenge.org, ", "https://build.atfchallenge.org");
    expect(gateway.namespace).toBe("/chat");
    expect(gateway.cors).toEqual({ origin: ["https://app.atfchallenge.org", "https://built.atfchallenge.org", "https://build.atfchallenge.org"], credentials: true });
    expect(gateway.cors.origin).not.toContain("https://untrusted.example.test");
  });

  it("uses the configured frontend when no explicit allowlist is set", async () => {
    expect((await options(undefined, "https://portal.example.test")).cors.origin).toEqual(["https://portal.example.test"]);
  });

  it("keeps the local development default", async () => {
    expect((await options()).cors.origin).toEqual(["http://localhost:3000"]);
  });
});
