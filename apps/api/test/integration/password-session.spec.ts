import "reflect-metadata";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import * as path from "path";
import * as bcrypt from "bcrypt";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "@/auth/auth.service";
import { AuthController } from "@/auth/auth.controller";
import { JwtStrategy } from "@/auth/strategies/jwt.strategy";
import { PortalType } from "@/auth/dto/auth.dto";
import { User, Role } from "@/database/entities/user.entity";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { ParticipantPreference } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Mentor } from "@/database/entities/mentor.entity";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { ParticipantsService } from "@/modules/participants/participants.service";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Password change session renewal", () => {
  let db: DataSource;
  let auth: AuthService;
  let cohort: Cohort;
  let sockets: { revokePrincipal: jest.Mock };
  const config = new ConfigService({ jwt: { secret: "password-session-regression" } });
  const jwt = new JwtService({ secret: "password-session-regression" });
  const oldPassword = "Temporary-password-123!";
  const newPassword = "New-password-456!";
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize();
    await db.runMigrations();
    cohort = await db.getRepository(Cohort).save({ name: "Session onboarding regression", status: CohortStatus.ACTIVE });
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(() => {
    sockets = { revokePrincipal: jest.fn() };
    auth = new AuthService(db.getRepository(User), db.getRepository(RefreshToken), db.getRepository(Participant), db.getRepository(Cohort), db.getRepository(Mentor), jwt, {} as any, config, sockets as any);
  });
  async function participant() {
    const id = randomUUID();
    return db.getRepository(Participant).save({ participantId: id, email: id + "@example.test", firstName: "Session", lastName: "Participant", country: "GH", cohortId: cohort.id, status: ParticipantStatus.ACTIVE, passwordHash: await bcrypt.hash(oldPassword, 10), mustChangePassword: true });
  }
  const validate = (token: string) => new JwtStrategy(config, db).validate(jwt.verify(token));

  it("replaces the revoked participant session, sets an HTTP-only refresh cookie, and allows onboarding to finish", async () => {
    const p = await participant();
    const current = await auth.loginWithPassword(p.email, oldPassword, PortalType.PARTICIPANT);
    const other = await auth.loginWithPassword(p.email, oldPassword, PortalType.PARTICIPANT);
    const controller = new AuthController(auth, {} as any, {} as any);
    const cookie = jest.fn();
    const response = await controller.changePassword({ id: p.id, role: Role.PARTICIPANT }, { currentPassword: oldPassword, newPassword },
      { headers: { "user-agent": "Onboarding regression" }, ip: "127.0.0.1", socket: {} } as Request, { cookie } as unknown as Response);
    expect(response.refreshToken).toBe("");
    expect(response.user.mustChangePassword).toBe(false);
    expect(cookie).toHaveBeenCalledWith("acmp_refresh", expect.any(String), expect.objectContaining({ httpOnly: true, path: "/api/auth" }));
    const freshRefresh = cookie.mock.calls[0][1];
    expect((await validate(response.accessToken)).id).toBe(p.id);
    await expect(validate(current.accessToken)).rejects.toThrow("Session has ended");
    await expect(validate(other.accessToken)).rejects.toThrow("Session has ended");
    await expect(auth.refreshAccessToken(current.refreshToken)).rejects.toThrow();
    await expect(auth.refreshAccessToken(other.refreshToken)).rejects.toThrow();
    expect((await auth.refreshAccessToken(freshRefresh)).user.id).toBe(p.id);
    const participants = new ParticipantsService(db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Cohort), { create: jest.fn() } as any, {} as any, config, { addParticipantToForumChannels: jest.fn() } as any);
    const completed = await participants.completeOnboarding(p.id, { profile: { firstName: p.firstName, lastName: p.lastName, country: "Ghana", githubAccountStatus: "no_account" }, skills: { skills: ["Python"], interests: ["Education"] }, preferences: { briefRankings: [], crossCountryWilling: true, buildDeployAbility: "confident", preferredRole: "builder", firstChoiceSector: "education", backupSector: "health", teamStatus: "need_team", matchingProfileConsent: false } });
    expect(completed).toMatchObject({ onboardingComplete: true, status: ParticipantStatus.READY, mustChangePassword: false });
    expect((await validate(response.accessToken)).id).toBe(p.id);
    expect(sockets.revokePrincipal).toHaveBeenCalledWith(p.id);
  });

  it("refuses an opted-out participant even if a legacy staff status update marked the account active", async () => {
    const p = await participant(); await db.getRepository(Participant).update(p.id, { programmeOptedOut: true, status: ParticipantStatus.ACTIVE });
    await expect(auth.loginWithPassword(p.email, oldPassword, PortalType.PARTICIPANT)).rejects.toThrow("deactivated");
  });

  it("also renews staff sessions without immediately invalidating the fresh refresh token", async () => {
    const user = await db.getRepository(User).save({ email: randomUUID() + "@example.test", role: Role.PROGRAM_MANAGER, passwordHash: await bcrypt.hash(oldPassword, 10), isActive: true });
    const old = await auth.generateTokens(user);
    const renewed = await auth.changePasswordAndRenewSession(user.id, user.role, oldPassword, newPassword);
    expect((await validate(renewed.accessToken)).id).toBe(user.id);
    await expect(validate(old.accessToken)).rejects.toThrow("Session has ended");
    expect((await auth.refreshAccessToken(renewed.refreshToken)).user.id).toBe(user.id);
    await expect(auth.loginWithPassword(user.email, oldPassword, PortalType.STAFF)).rejects.toThrow();
    expect((await auth.loginWithPassword(user.email, newPassword, PortalType.STAFF)).user.id).toBe(user.id);
  });

  it("keeps the existing session valid after an incorrect current password", async () => {
    const p = await participant();
    const old = await auth.loginWithPassword(p.email, oldPassword, PortalType.PARTICIPANT);
    await expect(auth.changePasswordAndRenewSession(p.id, Role.PARTICIPANT, "Incorrect-password", newPassword)).rejects.toThrow("Current password is incorrect");
    expect((await validate(old.accessToken)).id).toBe(p.id);
    expect((await auth.refreshAccessToken(old.refreshToken)).user.id).toBe(p.id);
    expect(sockets.revokePrincipal).not.toHaveBeenCalled();
  });

  it("rolls back the password and revocations if a replacement session cannot be saved", async () => {
    const p = await participant();
    const old = await auth.loginWithPassword(p.email, oldPassword, PortalType.PARTICIPANT);
    const generate = jest.spyOn(auth as any, "generateParticipantTokens").mockRejectedValue(new Error("Session persistence failed"));
    await expect(auth.changePasswordAndRenewSession(p.id, Role.PARTICIPANT, oldPassword, newPassword)).rejects.toThrow("Session persistence failed");
    generate.mockRestore();
    expect((await validate(old.accessToken)).id).toBe(p.id);
    expect((await auth.loginWithPassword(p.email, oldPassword, PortalType.PARTICIPANT)).user.mustChangePassword).toBe(true);
    expect(sockets.revokePrincipal).not.toHaveBeenCalled();
  });

  it("allows only one concurrent change using the old password", async () => {
    const p = await participant();
    const results = await Promise.allSettled([auth.changePasswordAndRenewSession(p.id, Role.PARTICIPANT, oldPassword, newPassword), auth.changePasswordAndRenewSession(p.id, Role.PARTICIPANT, oldPassword, "Other-password-789!")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.getRepository(RefreshToken).countBy({ participantId: p.id, isRevoked: false })).toBe(1);
  });
});
