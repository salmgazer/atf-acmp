import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { FirebaseService } from "./firebase.service";
import { User, Role } from "../database/entities/user.entity";
import { RefreshToken } from "../database/entities/refresh-token.entity";
import { Participant } from "../database/entities/participant.entity";
import { Cohort } from "../database/entities/cohort.entity";
import { PortalType } from "./dto/auth.dto";
import {
  createMockRepository,
  createMockJwtService,
  createMockConfigService,
  createTestUser,
} from "../../test/utils/test-utils";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createMockRepository>;
  let refreshTokenRepository: ReturnType<typeof createMockRepository>;
  let participantRepository: ReturnType<typeof createMockRepository>;
  let cohortRepository: ReturnType<typeof createMockRepository>;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let firebaseService: { verifyIdToken: jest.Mock };

  const mockUser = createTestUser({
    id: "user-123",
    email: "test@example.com",
    role: Role.PARTICIPANT,
    passwordHash: "hashed-password",
    isActive: true,
    mustChangePassword: false,
  });

  beforeEach(async () => {
    userRepository = createMockRepository();
    refreshTokenRepository = createMockRepository();
    participantRepository = createMockRepository();
    cohortRepository = createMockRepository();
    jwtService = createMockJwtService();
    firebaseService = { verifyIdToken: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepository },
        { provide: getRepositoryToken(Participant), useValue: participantRepository },
        { provide: getRepositoryToken(Cohort), useValue: cohortRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: FirebaseService, useValue: firebaseService },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("loginWithPassword", () => {
    it("should successfully login with valid credentials", async () => {
      // For STAFF portal, login uses the userRepository
      const staffUser = createTestUser({
        id: "user-123",
        email: "staff@example.com",
        role: Role.PROGRAM_MANAGER,
        passwordHash: "hashed-password",
        isActive: true,
        mustChangePassword: false,
      });
      userRepository.findOne.mockResolvedValue(staffUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      refreshTokenRepository.create.mockReturnValue({ token: "refresh-token" });
      refreshTokenRepository.save.mockResolvedValue({ token: "refresh-token" });

      const result = await service.loginWithPassword(
        "staff@example.com",
        "password123",
        PortalType.STAFF
      );

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("user");
      expect(result.user.email).toBe("staff@example.com");
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: "staff@example.com" },
      });
    });

    it("should throw UnauthorizedException for invalid email", async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.loginWithPassword("invalid@example.com", "password", PortalType.STAFF)
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for invalid password", async () => {
      const staffUser = createTestUser({
        id: "user-123",
        email: "staff@example.com",
        role: Role.PROGRAM_MANAGER,
        passwordHash: "hashed-password",
        isActive: true,
      });
      userRepository.findOne.mockResolvedValue(staffUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.loginWithPassword("staff@example.com", "wrong-password", PortalType.STAFF)
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for deactivated account", async () => {
      const inactiveUser = createTestUser({
        id: "user-123",
        email: "staff@example.com",
        role: Role.PROGRAM_MANAGER,
        passwordHash: "hashed-password",
        isActive: false,
      });
      userRepository.findOne.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.loginWithPassword("staff@example.com", "password", PortalType.STAFF)
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for wrong portal access", async () => {
      // PARTICIPANT trying to access STAFF portal
      userRepository.findOne.mockResolvedValue(mockUser); // PARTICIPANT role
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.loginWithPassword("test@example.com", "password", PortalType.STAFF)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("refreshAccessToken", () => {
    const mockRefreshToken = {
      id: "token-123",
      token: "valid-refresh-token",
      userId: "user-123",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isRevoked: false,
      createdAt: new Date(),
      user: mockUser,
    };

    it("should return new access token with valid refresh token", async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.refreshAccessToken("valid-refresh-token");

      expect(result).toHaveProperty("accessToken");
      expect(result.refreshToken).toBe("valid-refresh-token");
      expect(refreshTokenRepository.save).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for invalid refresh token", async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshAccessToken("invalid-token")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for expired refresh token", async () => {
      refreshTokenRepository.findOne.mockResolvedValue({
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      await expect(service.refreshAccessToken("expired-token")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for deactivated user", async () => {
      refreshTokenRepository.findOne.mockResolvedValue({
        ...mockRefreshToken,
        user: { ...mockUser, isActive: false },
      });

      await expect(service.refreshAccessToken("valid-token")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should invalidate token if password was changed after token creation", async () => {
      const passwordChangedAt = new Date(Date.now() + 1000); // After token creation
      refreshTokenRepository.findOne.mockResolvedValue({
        ...mockRefreshToken,
        user: { ...mockUser, passwordChangedAt },
      });

      await expect(service.refreshAccessToken("valid-token")).rejects.toThrow(
        UnauthorizedException
      );
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        mockRefreshToken.id,
        expect.objectContaining({ isRevoked: true })
      );
    });
  });

  describe("logout", () => {
    it("should revoke the refresh token", async () => {
      const mockToken = { id: "token-123", token: "refresh-token" };
      refreshTokenRepository.findOne.mockResolvedValue(mockToken);

      await service.logout("refresh-token");

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        "token-123",
        expect.objectContaining({
          isRevoked: true,
          revokedReason: "User logout",
        })
      );
    });

    it("should not throw if token not found", async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.logout("non-existent-token")).resolves.not.toThrow();
    });
  });

  describe("logoutAllSessions", () => {
    it("should revoke all refresh tokens for user", async () => {
      refreshTokenRepository.update.mockResolvedValue({ affected: 3, raw: {}, generatedMaps: [] });

      const result = await service.logoutAllSessions("user-123");

      expect(result).toBe(3);
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: "user-123", isRevoked: false },
        expect.objectContaining({
          isRevoked: true,
          revokedReason: "Logout all sessions",
        })
      );
    });
  });

  describe("markPasswordChanged", () => {
    it("should update user and revoke all tokens", async () => {
      await service.markPasswordChanged("user-123");

      expect(userRepository.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          mustChangePassword: false,
          passwordChangedAt: expect.any(Date),
        })
      );
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: "user-123", isRevoked: false },
        expect.objectContaining({
          isRevoked: true,
          revokedReason: "Password changed",
        })
      );
    });
  });

  describe("changePassword", () => {
    it("should change password and revoke all tokens", async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("new-hashed-password");

      await service.changePassword("user-123", "old-password", "new-password");

      expect(userRepository.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          passwordHash: "new-hashed-password",
          mustChangePassword: false,
        })
      );
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for wrong current password", async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword("user-123", "wrong-password", "new-password")
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("canAccessPortal", () => {
    it("should allow PARTICIPANT to access PARTICIPANT portal", () => {
      expect(service.canAccessPortal(Role.PARTICIPANT, PortalType.PARTICIPANT)).toBe(true);
    });

    it("should allow SUPER_ADMIN to access STAFF portal", () => {
      expect(service.canAccessPortal(Role.SUPER_ADMIN, PortalType.STAFF)).toBe(true);
    });

    it("should allow PROGRAM_MANAGER to access STAFF portal", () => {
      expect(service.canAccessPortal(Role.PROGRAM_MANAGER, PortalType.STAFF)).toBe(true);
    });

    it("should allow ORGANIZATION to access ORGANIZATION portal", () => {
      expect(service.canAccessPortal(Role.ORGANIZATION, PortalType.ORGANIZATION)).toBe(true);
    });

    it("should allow MENTOR to access MENTOR portal", () => {
      expect(service.canAccessPortal(Role.MENTOR, PortalType.MENTOR)).toBe(true);
    });

    it("should deny PARTICIPANT access to STAFF portal", () => {
      expect(service.canAccessPortal(Role.PARTICIPANT, PortalType.STAFF)).toBe(false);
    });

    it("should deny ORGANIZATION access to PARTICIPANT portal", () => {
      expect(service.canAccessPortal(Role.ORGANIZATION, PortalType.PARTICIPANT)).toBe(false);
    });
  });

  describe("verifyFirebaseToken", () => {
    it("should authenticate user with valid Firebase token", async () => {
      const decodedToken = { uid: "firebase-uid", email: "test@example.com" };
      firebaseService.verifyIdToken.mockResolvedValue(decodedToken);
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      refreshTokenRepository.create.mockReturnValue({ token: "refresh-token" });
      refreshTokenRepository.save.mockResolvedValue({ token: "refresh-token" });

      const result = await service.verifyFirebaseToken("valid-firebase-token", PortalType.PARTICIPANT);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("user");
      expect(firebaseService.verifyIdToken).toHaveBeenCalledWith("valid-firebase-token");
    });

    it("should throw UnauthorizedException for invalid Firebase token", async () => {
      firebaseService.verifyIdToken.mockResolvedValue(null);

      await expect(
        service.verifyFirebaseToken("invalid-token", PortalType.PARTICIPANT)
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if user not found", async () => {
      firebaseService.verifyIdToken.mockResolvedValue({ uid: "uid", email: "new@example.com" });
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyFirebaseToken("valid-token", PortalType.PARTICIPANT)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("getActiveSessions", () => {
    it("should return active sessions for user", async () => {
      const mockSessions = [
        { id: "1", userAgent: "Chrome", ipAddress: "127.0.0.1", createdAt: new Date() },
        { id: "2", userAgent: "Firefox", ipAddress: "127.0.0.2", createdAt: new Date() },
      ];
      refreshTokenRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getActiveSessions("user-123");

      expect(result).toHaveLength(2);
      expect(refreshTokenRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-123", isRevoked: false },
        order: { lastUsedAt: "DESC" },
      });
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired tokens", async () => {
      refreshTokenRepository.delete.mockResolvedValue({ affected: 5, raw: {} });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(refreshTokenRepository.delete).toHaveBeenCalled();
    });
  });
});
