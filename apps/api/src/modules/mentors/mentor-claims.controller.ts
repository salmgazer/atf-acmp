import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { MentorClaimsService } from "./mentor-claims.service";
import {
  BrowseMentorsQueryDto,
  BrowseMentorsResponseDto,
  ClaimMentorDto,
  ReleaseMentorClaimDto,
  SwapMentorDto,
  MentorClaimResponseDto,
  TeamClaimStatusDto,
  BookSessionDto,
  UpdateScheduledSessionDto,
  CancelSessionDto,
  DeclineSessionDto,
  CompleteSessionDto,
  RateSessionDto,
  ScheduledSessionResponseDto,
  ClaimEligibilityDto,
  ClaimSessionsQueryDto,
} from "./dto/mentor-claim.dto";

/**
 * Staff endpoints for viewing all sessions
 */
@ApiTags("Mentor Sessions - Staff")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin/mentor-sessions")
export class AdminMentorSessionsController {
  constructor(private readonly claimsService: MentorClaimsService) {}

  @Get()
  @ApiOperation({ summary: "Get all scheduled sessions for calendar view" })
  @ApiQuery({ name: "cohortId", required: false })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiResponse({ status: 200, description: "List of all scheduled sessions", type: [ScheduledSessionResponseDto] })
  async getAllSessions(
    @Query("cohortId") cohortId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<ScheduledSessionResponseDto[]> {
    return this.claimsService.getAllScheduledSessions(
      cohortId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}

/**
 * Participant endpoints for browsing and claiming mentors
 */
@ApiTags("Mentor Claims - Participant")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("mentor-claims")
export class MentorClaimsController {
  constructor(private readonly claimsService: MentorClaimsService) {}

  @Get("browse")
  @ApiOperation({ summary: "Browse available mentors by capability" })
  @ApiResponse({ status: 200, description: "List of available mentors" })
  async browseMentors(
    @Query() query: BrowseMentorsQueryDto,
  ): Promise<BrowseMentorsResponseDto> {
    return this.claimsService.browseMentors(query);
  }

  @Get("eligibility/:mentorId")
  @ApiOperation({ summary: "Check if team can claim a specific mentor" })
  @ApiResponse({ status: 200, description: "Eligibility check result" })
  async checkEligibility(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @CurrentUser() user: any,
  ): Promise<ClaimEligibilityDto> {
    // User must have a team - get teamId from user context
    const teamId = user.teamId;
    if (!teamId) {
      return {
        eligible: false,
        reason: "You must be part of a team to claim a mentor",
        teamHasActiveClaim: false,
        mentorHasCapacity: false,
      };
    }
    return this.claimsService.checkClaimEligibility(teamId, mentorId);
  }

  @Post("claim")
  @ApiOperation({ summary: "Claim a mentor for your team" })
  @ApiResponse({ status: 201, description: "Mentor claimed successfully" })
  async claimMentor(
    @Body() dto: ClaimMentorDto,
    @CurrentUser() user: any,
  ): Promise<MentorClaimResponseDto> {
    const teamId = user.teamId;
    if (!teamId) {
      throw new Error("You must be part of a team to claim a mentor");
    }
    return this.claimsService.claimMentor(teamId, dto, user.participantId);
  }

  @Get("team-status")
  @ApiOperation({ summary: "Get current team claim status" })
  @ApiResponse({ status: 200, description: "Team claim status" })
  async getTeamStatus(@CurrentUser() user: any): Promise<TeamClaimStatusDto> {
    const teamId = user.teamId;
    if (!teamId) {
      return {
        hasClaim: false,
        canSwap: false,
        sessionsRemaining: 0,
        mentorClaimUnlocked: false,
        unlockingStageReason: "You must be part of a team to claim a mentor",
      };
    }
    return this.claimsService.getTeamClaimStatus(teamId);
  }

  @Delete("release")
  @ApiOperation({ summary: "Release current mentor claim" })
  @ApiResponse({ status: 200, description: "Claim released" })
  async releaseClaim(
    @Body() dto: ReleaseMentorClaimDto,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean }> {
    const teamId = user.teamId;
    if (!teamId) {
      throw new Error("You must be part of a team");
    }
    await this.claimsService.releaseClaim(teamId, dto);
    return { success: true };
  }

  @Post("swap")
  @ApiOperation({ summary: "Swap to a different mentor (one-time)" })
  @ApiResponse({ status: 201, description: "Mentor swapped successfully" })
  async swapMentor(
    @Body() dto: SwapMentorDto,
    @CurrentUser() user: any,
  ): Promise<MentorClaimResponseDto> {
    const teamId = user.teamId;
    if (!teamId) {
      throw new Error("You must be part of a team");
    }
    return this.claimsService.swapMentor(teamId, dto, user.participantId);
  }
}

/**
 * Session booking endpoints for participants
 */
@ApiTags("Mentor Sessions - Participant")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("mentor-claims/:claimId/sessions")
export class MentorClaimSessionsController {
  constructor(private readonly claimsService: MentorClaimsService) {}

  @Get()
  @ApiOperation({ summary: "Get all sessions for a claim" })
  @ApiResponse({ status: 200, description: "List of sessions" })
  async getSessions(
    @Param("claimId", ParseUUIDPipe) claimId: string,
    @Query() query: ClaimSessionsQueryDto,
  ): Promise<ScheduledSessionResponseDto[]> {
    return this.claimsService.getClaimSessions(claimId, query);
  }

  @Post()
  @ApiOperation({ summary: "Book a new session" })
  @ApiResponse({ status: 201, description: "Session booked" })
  async bookSession(
    @Param("claimId", ParseUUIDPipe) claimId: string,
    @Body() dto: BookSessionDto,
    @CurrentUser() user: any,
  ): Promise<ScheduledSessionResponseDto> {
    return this.claimsService.bookSession(claimId, dto, user.participantId);
  }

  @Put(":sessionId")
  @ApiOperation({ summary: "Update a scheduled session" })
  @ApiResponse({ status: 200, description: "Session updated" })
  async updateSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateScheduledSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    return this.claimsService.updateSession(sessionId, dto);
  }

  @Delete(":sessionId")
  @ApiOperation({ summary: "Cancel a scheduled session" })
  @ApiResponse({ status: 200, description: "Session cancelled" })
  async cancelSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: CancelSessionDto,
  ): Promise<{ success: boolean }> {
    await this.claimsService.cancelSession(sessionId, dto, "team");
    return { success: true };
  }

  @Post(":sessionId/rate")
  @ApiOperation({ summary: "Rate a completed session" })
  @ApiResponse({ status: 200, description: "Session rated" })
  async rateSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: RateSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    return this.claimsService.rateSession(sessionId, dto);
  }
}

/**
 * Mentor portal endpoints for managing sessions
 */
@ApiTags("Mentor Sessions - Mentor Portal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("mentor-portal/sessions")
export class MentorPortalSessionsController {
  constructor(private readonly claimsService: MentorClaimsService) {}

  @Get()
  @ApiOperation({ summary: "Get all my scheduled sessions" })
  @ApiResponse({ status: 200, description: "List of scheduled sessions", type: [ScheduledSessionResponseDto] })
  async getMySessions(
    @CurrentUser() user: { email: string },
    @Query("teamId") teamId?: string,
  ): Promise<ScheduledSessionResponseDto[]> {
    const mentor = await this.claimsService.getMentorByEmail(user.email);
    return this.claimsService.getMentorScheduledSessions(mentor.id, teamId);
  }

  @Put(":sessionId/confirm")
  @ApiOperation({ summary: "Confirm a session request" })
  @ApiResponse({ status: 200, description: "Session confirmed" })
  async confirmSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ): Promise<ScheduledSessionResponseDto> {
    return this.claimsService.confirmSession(sessionId);
  }

  @Put(":sessionId/decline")
  @ApiOperation({ summary: "Decline a session request" })
  @ApiResponse({ status: 200, description: "Session declined" })
  async declineSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: DeclineSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    return this.claimsService.declineSession(sessionId, dto.reason);
  }

  @Put(":sessionId/complete")
  @ApiOperation({ summary: "Mark session as completed" })
  @ApiResponse({ status: 200, description: "Session completed" })
  async completeSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: CompleteSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    return this.claimsService.completeSession(sessionId, dto);
  }

  @Delete(":sessionId")
  @ApiOperation({ summary: "Cancel a session (mentor)" })
  @ApiResponse({ status: 200, description: "Session cancelled" })
  async cancelSession(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: CancelSessionDto,
  ): Promise<{ success: boolean }> {
    await this.claimsService.cancelSession(sessionId, dto, "mentor");
    return { success: true };
  }
}
