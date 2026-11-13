import "reflect-metadata";
import { INestApplication, Logger, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AddressInfo } from "net";
import { AuthController } from "@/auth/auth.controller";
import { AuthService } from "@/auth/auth.service";
import { MagicLinkService } from "@/auth/magic-link.service";
import { PortalType } from "@/auth/dto/auth.dto";
import { EmailService } from "@/email/email.service";
import { configureBodyParsers } from "@/common/configure-body-parsers";

describe("Password reset request over HTTP", () => {
  let app: INestApplication, base: string;
  const auth = { requestPasswordReset: jest.fn() };
  const email = { requireDeliveryConfiguration: jest.fn(), sendPasswordResetLink: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
      { provide: AuthService, useValue: auth }, { provide: MagicLinkService, useValue: {} }, { provide: EmailService, useValue: email },
    ] }).compile();
    app = module.createNestApplication({ logger: false });
    configureBodyParsers(app);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/auth/forgot-password`;
  });
  beforeEach(() => {
    jest.resetAllMocks();
    auth.requestPasswordReset.mockResolvedValue({ token: "test-reset-token", firstName: "Learner" });
    email.sendPasswordResetLink.mockResolvedValue(undefined);
  });
  afterAll(async () => { if (app) await app.close(); });
  const request = (address = "participant@example.test") => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address, portal: "participant" }) });

  it("normalizes the email before lookup and sending, preserving the reset token and portal", async () => {
    const response = await request("  PARTICIPANT@EXAMPLE.TEST  ");
    expect(response.status).toBe(200);
    expect(auth.requestPasswordReset).toHaveBeenCalledWith("participant@example.test", PortalType.PARTICIPANT);
    expect(email.sendPasswordResetLink).toHaveBeenCalledWith({ to: "participant@example.test", token: "test-reset-token", firstName: "Learner", portal: "participant" });
  });
  it("returns the same response for registered and unregistered addresses", async () => {
    const known = await request();
    auth.requestPasswordReset.mockResolvedValue(null);
    const unknown = await request("unknown@example.test");
    expect(known.status).toBe(200); expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
    expect(email.sendPasswordResetLink).toHaveBeenCalledTimes(1);
  });
  it("reports unavailable delivery uniformly, before checking whether the account exists", async () => {
    email.requireDeliveryConfiguration.mockImplementation(() => { throw new Error("No provider configured"); });
    for (const address of ["participant@example.test", "unknown@example.test"]) {
      const response = await request(address);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ message: "Password reset is temporarily unavailable. Please try again later." });
    }
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });
  it("records a provider rejection as a failure without claiming acceptance or exposing account existence", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    try {
      email.sendPasswordResetLink.mockRejectedValue(new Error("Provider rejected delivery"));
      const failed = await request();
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to send password reset email"));
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining("accepted by provider"));
      auth.requestPasswordReset.mockResolvedValue(null);
      const unknown = await request("unknown@example.test");
      expect(failed.status).toBe(unknown.status);
      expect(await failed.json()).toEqual(await unknown.json());
    } finally { log.mockRestore(); error.mockRestore(); }
  });
});
