import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MentorStatus } from "@/database/entities/mentor.entity";

// ============ Mentor DTOs ============

export class CreateMentorDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  calendlyLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxTeams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  verticalScope?: string[];

  @ApiProperty()
  @IsUUID()
  cohortId: string;
}

export class UpdateMentorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  calendlyLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxTeams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  verticalScope?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MentorStatus)
  status?: MentorStatus;
}

export class MentorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MentorStatus)
  status?: MentorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasCapacity?: boolean;

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

export class PaginatedMentorsDto {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============ Bulk Import DTOs ============

export class BulkImportMentorDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  expertise?: string[];
  maxTeams?: number;
}

export class BulkImportResultDto {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    email?: string;
    error: string;
  }>;
  imported: string[];
}

// ============ Assignment DTOs ============

export class AssignMentorDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UnassignMentorDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============ Session DTOs ============

export class CreateSessionDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiProperty()
  @IsDateString()
  sessionDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsDiscussed?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamProgressNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextSessionGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionType?: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsDiscussed?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamProgressNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextSessionGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionType?: string;
}

export class SessionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

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

// ============ Statistics DTOs ============

export class MentorStatisticsDto {
  total: number;
  active: number;
  inactive: number;
  imported: number;
  totalCapacity: number;
  assignedTeams: number;
  availableSlots: number;
  averageTeamsPerMentor: number;
  totalSessions: number;
  totalSessionHours: number;
}

export class MentorCapacityDto {
  mentorId: string;
  mentorName: string;
  email: string;
  maxTeams: number;
  assignedTeams: number;
  availableSlots: number;
  verticalScope: string[];
  status: MentorStatus;
}
