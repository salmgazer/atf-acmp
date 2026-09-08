import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  MinLength,
  MaxLength,
  Length,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Team,
  TeamStatus,
  TeamRole,
  TeamMember,
  TeamInvitation,
  InvitationStatus,
} from "@/database/entities/team.entity";

// ============ Query DTOs ============

export class TeamQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional({ enum: TeamStatus })
  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  briefId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasbrief?: boolean;
}

export class PaginatedTeamsDto {
  @ApiProperty({ type: [Object] })
  data: Team[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

// ============ Create/Update DTOs ============

export class CreateTeamDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsUUID()
  cohortId: string;

  @ApiProperty({ description: "Participant ID of the creator (becomes team lead)" })
  @IsUUID()
  creatorId: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class AssignBriefDto {
  @ApiProperty()
  @IsUUID()
  briefId: string;
}

export class DisqualifyTeamDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsUUID()
  disqualifiedBy: string;
}

// ============ Member DTOs ============

export class AddMemberDto {
  @ApiProperty()
  @IsUUID()
  participantId: string;

  @ApiPropertyOptional({ enum: TeamRole })
  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole = TeamRole.MEMBER;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: TeamRole })
  @IsEnum(TeamRole)
  role: TeamRole;
}

export class JoinByCodeDto {
  @ApiProperty({ description: "Team invite code" })
  @IsString()
  @Length(8, 8)
  inviteCode: string;

  @ApiProperty()
  @IsUUID()
  participantId: string;
}

// ============ Invitation DTOs ============

export class SendInvitationDto {
  @ApiProperty()
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: "Participant ID of the inviter" })
  @IsUUID()
  invitedBy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RespondInvitationDto {
  @ApiProperty({ enum: ["accept", "decline"] })
  @IsString()
  response: "accept" | "decline";
}

export class InvitationQueryDto {
  @ApiPropertyOptional({ enum: InvitationStatus })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;
}

// ============ Search DTOs ============

export class SearchParticipantsDto {
  @ApiProperty()
  @IsString()
  query: string;

  @ApiProperty()
  @IsUUID()
  cohortId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;
}

// ============ Statistics DTOs ============

export class TeamStatisticsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  forming: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  submitted: number;

  @ApiProperty()
  evaluated: number;

  @ApiProperty()
  disqualified: number;

  @ApiProperty()
  withBrief: number;

  @ApiProperty()
  withoutBrief: number;

  @ApiProperty()
  averageMembers: number;
}

// ============ Response DTOs ============

export class TeamWithMembersDto extends Team {
  @ApiProperty({ type: [Object] })
  declare members: TeamMember[];

  // Note: memberCount is inherited as a getter from Team
}

export class InvitationWithDetailsDto extends TeamInvitation {
  @ApiProperty()
  declare team: Team;

  @ApiProperty()
  declare participant: any; // Participant

  @ApiProperty()
  declare inviter: any; // Participant
}
