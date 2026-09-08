import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { User, Role } from "../database/entities/user.entity";
import { RefreshToken } from "../database/entities/refresh-token.entity";
import { Participant } from "../database/entities/participant.entity";
import { FirebaseService } from "./firebase.service";
import { PortalType, AuthResponseDto } from "./dto/auth.dto";

// Token expiry configuration
const ACCESS_TOKEN_EXPIRY = "1h"; // 1 hour
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600; // 1 hour in seconds

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    private readonly jwtService: JwtService,
    private readonly firebaseService: FirebaseService,
    private readonly configService: ConfigService,
  ) {}

  async verifyFirebaseToken(
    idToken: string,
    portal?: PortalType,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    const decodedToken = await this.firebaseService.verifyIdToken(idToken);
    if (!decodedToken) {
      throw new UnauthorizedException("Invalid Firebase token");
    }

    let user = await this.userRepository.findOne({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!user) {
      user = await this.userRepository.findOne({
        where: { email: decodedToken.email },
      });

      if (user) {
        user.firebaseUid = decodedToken.uid;
        await this.userRepository.save(user);
      }
    }

    if (!user) {
      throw new UnauthorizedException("User not found. Please contact support.");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    if (portal && !this.canAccessPortal(user.role, portal)) {
      throw new UnauthorizedException("You don't have access to this portal");
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.generateTokens(user, userAgent, ipAddress);
  }

  async loginWithPassword(
    email: string,
    password: string,
    portal: PortalType,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    // For participant portal, use Firebase authentication
    if (portal === PortalType.PARTICIPANT) {
      return this.loginParticipantWithPassword(email, password, userAgent, ipAddress);
    }

    // For other portals, use the users table
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    if (!this.canAccessPortal(user.role, portal)) {
      throw new UnauthorizedException("You don't have access to this portal");
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.generateTokens(user, userAgent, ipAddress);
  }

  /**
   * Login participant using email and password (participant ID initially)
   */
  private async loginParticipantWithPassword(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    // Find participant by email
    const participant = await this.participantRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!participant) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (participant.status === "inactive") {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Verify password against stored hash
    if (!participant.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, participant.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Generate tokens for participant
    return this.generateParticipantTokens(participant, userAgent, ipAddress);
  }

  /**
   * Generate tokens for a participant (different from User entity)
   */
  private async generateParticipantTokens(
    participant: Participant,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    const accessToken = this.generateParticipantAccessToken(participant);
    
    // Create a pseudo-user for refresh token storage
    // We'll use participant.id as the userId reference
    const refreshToken = await this.createParticipantRefreshToken(participant, userAgent, ipAddress);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: participant.id,
        email: participant.email,
        role: Role.PARTICIPANT,
        firstName: participant.firstName,
        lastName: participant.lastName,
        mustChangePassword: participant.mustChangePassword,
        participantId: participant.participantId,
        participant: {
          id: participant.id,
          participantId: participant.participantId,
          cohortId: participant.cohortId,
        },
      },
    };
  }

  private generateParticipantAccessToken(participant: Participant): string {
    const payload = {
      sub: participant.id,
      email: participant.email,
      role: Role.PARTICIPANT,
      participantId: participant.participantId,
      cohortId: participant.cohortId,
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  private async createParticipantRefreshToken(
    participant: Participant,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<RefreshToken> {
    const token = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const refreshToken = this.refreshTokenRepository.create({
      token,
      participantId: participant.id, // Store participant ID in dedicated field
      expiresAt,
      userAgent,
      ipAddress,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  async refreshAccessToken(
    refreshTokenValue: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue, isRevoked: false },
      relations: ["user"],
    });

    if (!refreshToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token has expired");
    }

    // Check if this is a participant token
    if (refreshToken.participantId) {
      return this.refreshParticipantToken(refreshToken, refreshTokenValue);
    }

    // Handle regular user token
    const user = refreshToken.user;

    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && refreshToken.createdAt < user.passwordChangedAt) {
      await this.revokeRefreshToken(refreshToken.id, "Password changed");
      throw new UnauthorizedException("Session invalidated due to password change");
    }

    // Update last used timestamp
    refreshToken.lastUsedAt = new Date();
    await this.refreshTokenRepository.save(refreshToken);

    // Generate new access token (keep same refresh token)
    const accessToken = this.generateAccessToken(user);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: this.formatUserResponse(user),
    };
  }

  private async refreshParticipantToken(
    refreshToken: RefreshToken,
    refreshTokenValue: string,
  ): Promise<AuthResponseDto> {
    const participant = await this.participantRepository.findOne({
      where: { id: refreshToken.participantId! },
    });

    if (!participant) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (participant.status === "inactive") {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Update last used timestamp
    refreshToken.lastUsedAt = new Date();
    await this.refreshTokenRepository.save(refreshToken);

    // Generate new access token
    const accessToken = this.generateParticipantAccessToken(participant);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: participant.id,
        email: participant.email,
        role: Role.PARTICIPANT,
        firstName: participant.firstName,
        lastName: participant.lastName,
        mustChangePassword: participant.mustChangePassword,
        participantId: participant.participantId,
        participant: {
          id: participant.id,
          participantId: participant.participantId,
          cohortId: participant.cohortId,
        },
      },
    };
  }

  async logout(refreshTokenValue: string): Promise<void> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue },
    });

    if (refreshToken) {
      await this.revokeRefreshToken(refreshToken.id, "User logout");
    }
  }

  async logoutAllSessions(userId: string): Promise<number> {
    const result = await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: "Logout all sessions" },
    );
    return result.affected || 0;
  }

  async revokeRefreshToken(tokenId: string, reason: string): Promise<void> {
    await this.refreshTokenRepository.update(tokenId, {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
    });
  }

  async markPasswordChanged(userId: string): Promise<void> {
    const now = new Date();
    await this.userRepository.update(userId, {
      mustChangePassword: false,
      passwordChangedAt: now,
    });

    // Revoke all refresh tokens for this user (invalidate all sessions)
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: now, revokedReason: "Password changed" },
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("User not found");
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    const now = new Date();

    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    });

    // Revoke all refresh tokens (invalidate all sessions)
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: now, revokedReason: "Password changed" },
    );
  }

  /**
   * Change password for a participant
   */
  async changeParticipantPassword(
    participantId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { id: participantId },
    });

    if (!participant) {
      throw new UnauthorizedException("Participant not found");
    }

    // Verify current password
    if (!participant.passwordHash) {
      throw new UnauthorizedException("Invalid current password");
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, participant.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update participant record
    participant.passwordHash = newPasswordHash;
    participant.mustChangePassword = false;
    await this.participantRepository.save(participant);

    // Revoke all refresh tokens for this participant
    const now = new Date();
    await this.refreshTokenRepository.update(
      { participantId, isRevoked: false },
      { isRevoked: true, revokedAt: now, revokedReason: "Password changed" },
    );
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  async getActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      order: { lastUsedAt: "DESC" },
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async generateTokens(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user, userAgent, ipAddress);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: this.formatUserResponse(user),
    };
  }

  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  private async createRefreshToken(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<RefreshToken> {
    const token = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId: user.id,
      expiresAt,
      userAgent,
      ipAddress,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  // Legacy method for backward compatibility
  generateToken(user: User): string {
    return this.generateAccessToken(user);
  }

  // Generate token for organization (no User record needed)
  generateTokenForOrganization(org: { id: string; email: string }): string {
    const payload = {
      sub: org.id,
      email: org.email,
      role: Role.ORGANIZATION,
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  generateMagicCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  canAccessPortal(role: Role, portal: PortalType): boolean {
    switch (portal) {
      case PortalType.STAFF:
        return [Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER].includes(role);
      case PortalType.ORGANIZATION:
        return role === Role.ORGANIZATION;
      case PortalType.PARTICIPANT:
        return role === Role.PARTICIPANT;
      case PortalType.MENTOR:
        return role === Role.MENTOR;
      default:
        return false;
    }
  }

  private formatUserResponse(user: User): AuthResponseDto["user"] {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
