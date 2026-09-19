import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Participant,
  ParticipantStatus,
  ParticipantPreference,
} from "@/database/entities/participant.entity";

// ============ Query DTOs ============

export class ParticipantQueryDto {
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
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: ParticipantStatus })
  @IsOptional()
  @IsEnum(ParticipantStatus)
  status?: ParticipantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  onboardingComplete?: boolean;
}

export class PaginatedParticipantsDto {
  @ApiProperty({ type: [Object] })
  data: Participant[];

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

export class CreateParticipantDto {
  @ApiProperty()
  @IsString()
  participantId: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty()
  @IsUUID()
  cohortId: string;
}

export class UpdateParticipantDto {
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
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}

// ============ Bulk Import DTOs ============

export class BulkImportParticipantRowDto {
  @ApiProperty({ description: "Unique participant ID from external system" })
  @IsString()
  participantId: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class BulkImportParticipantsDto {
  @ApiProperty()
  @IsUUID()
  cohortId: string;

  @ApiProperty({ type: [BulkImportParticipantRowDto] })
  @ValidateNested({ each: true })
  @Type(() => BulkImportParticipantRowDto)
  @ArrayMinSize(1)
  participants: BulkImportParticipantRowDto[];

  @ApiPropertyOptional({ default: true, description: "Send welcome emails to participants" })
  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean = true;
}

export class ImportResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  participantId: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  error?: string;
}

export class BulkImportResultDto {
  @ApiProperty()
  totalProcessed: number;

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failureCount: number;

  @ApiProperty({ type: [ImportResultDto] })
  results: ImportResultDto[];
}

// ============ Onboarding DTOs ============

export class OnboardingProfileDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class OnboardingSkillsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  interests: string[];
}

export class OnboardingPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  verticalId1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  verticalId2?: string;

  @ApiProperty({ type: [String], description: "Ranked brief IDs (top 5)" })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMaxSize(5)
  briefRankings: string[];

  @ApiProperty()
  @IsBoolean()
  crossCountryWilling: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  availabilityNotes?: string;
}

export class CompleteOnboardingDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => OnboardingProfileDto)
  profile: OnboardingProfileDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => OnboardingSkillsDto)
  skills: OnboardingSkillsDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => OnboardingPreferencesDto)
  preferences: OnboardingPreferencesDto;
}

// ============ Password Change DTOs ============

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  newPassword: string;
}

export class ForceChangePasswordDto {
  @ApiProperty({ description: "The initial password (participant ID)" })
  @IsString()
  initialPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  newPassword: string;
}

// ============ Statistics DTO ============

export class ParticipantStatisticsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  imported: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  onboarding: number;

  @ApiProperty()
  ready: number;

  @ApiProperty()
  assigned: number;

  @ApiProperty()
  inactive: number;

  @ApiProperty()
  onboardingCompleted: number;

  @ApiProperty()
  passwordChanged: number;

  @ApiProperty({ type: Object })
  byCountry: Record<string, number>;
}
