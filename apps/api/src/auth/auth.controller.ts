import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { MagicLinkService } from "./magic-link.service";
import {
  FirebaseVerifyDto,
  LoginDto,
  MagicLinkRequestDto,
  VerifyMagicCodeDto,
  RefreshTokenDto,
  ChangePasswordDto,
  AuthResponseDto,
  PortalType,
} from "./dto/auth.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthThrottle, StrictThrottle } from "../common/decorators/throttle.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly magicLinkService: MagicLinkService
  ) {}

  @Post("firebase/verify")
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify Firebase ID token and get JWT" })
  @ApiResponse({ status: 200, description: "Authentication successful", type: AuthResponseDto })
  @ApiResponse({ status: 401, description: "Invalid token or unauthorized" })
  async verifyFirebaseToken(
    @Body() dto: FirebaseVerifyDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.verifyFirebaseToken(dto.idToken, dto.portal, userAgent, ipAddress);
  }

  @Post("login")
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Login successful", type: AuthResponseDto })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.loginWithPassword(dto.email, dto.password, dto.portal, userAgent, ipAddress);
  }

  @Post("refresh")
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  @ApiResponse({ status: 200, description: "Token refreshed", type: AuthResponseDto })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.refreshAccessToken(dto.refreshToken, userAgent, ipAddress);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and invalidate refresh token" })
  @ApiResponse({ status: 200, description: "Logged out successfully" })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: "Logged out successfully" };
  }

  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout from all sessions" })
  @ApiResponse({ status: 200, description: "Logged out from all sessions" })
  async logoutAll(@CurrentUser("id") userId: string): Promise<{ message: string; sessionsRevoked: number }> {
    const count = await this.authService.logoutAllSessions(userId);
    return { message: "Logged out from all sessions", sessionsRevoked: count };
  }

  @Post("magic-link")
  @Public()
  @StrictThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request magic link code (for organizations/mentors)" })
  @ApiResponse({ status: 200, description: "Code sent to email" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  async requestMagicLink(@Body() dto: MagicLinkRequestDto): Promise<{ message: string }> {
    if (dto.portal !== PortalType.ORGANIZATION && dto.portal !== PortalType.MENTOR) {
      return { message: "Magic link is only available for organizations and mentors" };
    }
    await this.magicLinkService.sendMagicCode(dto.email, dto.portal);
    return { message: "Verification code sent to your email" };
  }

  @Post("verify-code")
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify magic link code" })
  @ApiResponse({ status: 200, description: "Code verified, token returned", type: AuthResponseDto })
  @ApiResponse({ status: 401, description: "Invalid or expired code" })
  async verifyMagicCode(@Body() dto: VerifyMagicCodeDto): Promise<AuthResponseDto> {
    return this.magicLinkService.verifyCode(dto.email, dto.code);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change password" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 401, description: "Current password is incorrect" })
  async changePassword(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (user.role === "participant") {
      await this.authService.changeParticipantPassword(user.id, dto.currentPassword, dto.newPassword);
    } else {
      await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    }
    return { message: "Password changed successfully. Please log in again." };
  }

  @Post("password-changed")
  @UseGuards(JwtAuthGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mark password as changed (for Firebase password change)" })
  @ApiResponse({ status: 200, description: "Password change recorded" })
  async passwordChanged(@CurrentUser("id") userId: string): Promise<{ message: string }> {
    await this.authService.markPasswordChanged(userId);
    return { message: "Password change recorded" };
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get active sessions for current user" })
  @ApiResponse({ status: 200, description: "List of active sessions" })
  async getActiveSessions(@CurrentUser("id") userId: string) {
    const sessions = await this.authService.getActiveSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
    }));
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Current user data" })
  async getCurrentUser(@CurrentUser() user: any): Promise<any> {
    const response: any = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    
    // Include participant data if this is a participant
    if (user.role === 'participant') {
      response.participantId = user.participantId;
      response.participant = {
        id: user.id,
        participantId: user.participantId,
        cohortId: user.cohortId,
        teamId: user.teamId,
      };
    }
    
    return response;
  }
}
