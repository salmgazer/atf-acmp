import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MentorCapability, MentorClaimStatus, ScheduledSessionStatus } from "@/database/entities/mentor.entity";

// ============ Browse Mentors DTOs ============

export class BrowseMentorsQueryDto {
  @ApiPropertyOptional({ enum: MentorCapability, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MentorCapability, { each: true })
  capabilities?: MentorCapability[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export class MentorBrowseItemDto {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise: string[];
  capabilities: MentorCapability[];
  linkedinUrl?: string;
  availableClaimSlots: number;
  isAvailable: boolean;
}

export class BrowseMentorsResponseDto {
  data: MentorBrowseItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============ Claim DTOs ============

export class ClaimMentorDto {
  @ApiProperty({ description: "ID of the mentor to claim" })
  @IsUUID()
  mentorId: string;

  @ApiPropertyOptional({ description: "Snapshot of team proposal at claim time" })
  @IsOptional()
  proposalSnapshot?: Record<string, any>;
}

export class ReleaseMentorClaimDto {
  @ApiPropertyOptional({ description: "Reason for releasing the claim" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SwapMentorDto {
  @ApiProperty({ description: "ID of the new mentor to swap to" })
  @IsUUID()
  newMentorId: string;

  @ApiPropertyOptional({ description: "Reason for swapping mentor" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MentorClaimResponseDto {
  id: string;
  mentorId: string;
  teamId: string;
  claimedAt: Date;
  expiresAt: Date;
  status: MentorClaimStatus;
  sessionCount: number; // Completed sessions
  bookedSessionCount: number; // Scheduled/booked sessions (includes completed)
  swapUsed: boolean;
  mentor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    title?: string;
    profileImageUrl?: string;
    capabilities: MentorCapability[];
  };
}

export class TeamClaimStatusDto {
  hasClaim: boolean;
  claim?: MentorClaimResponseDto;
  canSwap: boolean;
  sessionsRemaining: number;
  nextSessionDeadline?: Date;
  mentorClaimUnlocked: boolean;
  unlockingStageName?: string;
  unlockingStageReason?: string;
}

// ============ Scheduled Session DTOs ============

export class BookSessionDto {
  @ApiProperty({ description: "Date for the session (YYYY-MM-DD format)" })
  @IsDateString()
  date: string;

  @ApiProperty({ description: "Start time for the session (HH:MM format, 24-hour)", example: "10:00" })
  @IsString()
  startTime: string;

  @ApiProperty({ description: "Specific question or topic for the session" })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  question: string;

  @ApiPropertyOptional({ description: "Timezone for the session (default Africa/Nairobi)" })
  @IsOptional()
  @IsString()
  timezone?: string = "Africa/Nairobi";
}

export class UpdateScheduledSessionDto {
  @ApiPropertyOptional({ description: "New date and time for the session" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: "Updated question or topic" })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  question?: string;

  @ApiPropertyOptional({ description: "Duration in minutes" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(90)
  durationMinutes?: number;
}

export class CancelSessionDto {
  @ApiProperty({ description: "Reason for cancellation" })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class DeclineSessionDto {
  @ApiPropertyOptional({ description: "Reason for declining the session request" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CompleteSessionDto {
  @ApiPropertyOptional({ description: "Notes from the session" })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ description: "Action items from the session" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional({ description: "Feedback from mentor" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mentorFeedback?: string;
}

export class RateSessionDto {
  @ApiProperty({ description: "Rating from 1-5" })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: "Feedback from team" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teamFeedback?: string;
}

export class ScheduledSessionResponseDto {
  id: string;
  claimId: string;
  mentorId: string;
  teamId: string;
  sessionNumber: number;
  scheduledAt: Date;
  durationMinutes: number;
  question: string;
  status: ScheduledSessionStatus;
  googleEventId?: string;
  googleCalendarLink?: string;
  googleMeetLink?: string;
  confirmedByMentor: boolean;
  confirmedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  completedAt?: Date;
  notes?: string;
  actionItems: string[];
  mentorFeedback?: string;
  teamFeedback?: string;
  rating?: number;
  mentor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

export class ClaimSessionsQueryDto {
  @ApiPropertyOptional({ enum: ScheduledSessionStatus })
  @IsOptional()
  @IsEnum(ScheduledSessionStatus)
  status?: ScheduledSessionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ============ Eligibility DTOs ============

export class ClaimEligibilityDto {
  eligible: boolean;
  reason?: string;
  existingClaim?: MentorClaimResponseDto;
  teamHasActiveClaim: boolean;
  mentorHasCapacity: boolean;
  mentorClaimUnlocked?: boolean;
  unlockingStageName?: string;
}
