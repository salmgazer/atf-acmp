import { IsInt as QueryIsInt, Min as QueryMin, Max as QueryMax } from "class-validator";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";
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
  MaxLength, MinLength, IsIn, IsDefined, ValidateIf, Matches,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS, GITHUB_USERNAME_PATTERN, type BuildDeployAbility, type MatchingSector, type MatchingTeamStatus, type MatchingRole } from "@acmp/shared";
import {
  Participant,
  ParticipantStatus,
  ParticipantPreference,
} from "@/database/entities/participant.entity";

// ============ Query DTOs ============

export class ParticipantQueryDto {
  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsBoolean() @StrictBoolean() ungrouped?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(1000000)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
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
  @StrictBoolean()
  onboardingComplete?: boolean;
}

export class PaginatedParticipantsDto {
  @ApiProperty({ type: [Object] })
  data: Participant[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(1000000)
  page: number;

  @ApiProperty()
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
  limit: number;

  @ApiProperty()
  totalPages: number;
}

// ============ Create/Update DTOs ============

export class CreateParticipantDto {
  @IsOptional() @IsString() group?: string;

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

export class AssignParticipantGroupDto {
  @IsOptional() @IsString()
  group?: string | null;
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
  @IsOptional() @IsString() group?: string;

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
  @StrictBoolean()
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
  @IsString() @MinLength(1) @MaxLength(255) firstName: string;
  @IsString() @MinLength(1) @MaxLength(255) lastName: string;
  @IsOptional() @IsString() @MaxLength(255) institution?: string;
  @IsOptional() @IsString() @MaxLength(50) phoneNumber?: string;
  @IsString() @MinLength(1) @MaxLength(255) country: string;
  @IsOptional() @IsString() @MaxLength(50) whatsappNumber?: string;
  @IsOptional() @IsString() @MaxLength(150) city?: string;
  @IsOptional() @IsString() @MaxLength(150) locationType?: string;
  @IsOptional() @IsString() @MaxLength(100) gender?: string;
  @IsOptional() @IsString() @MaxLength(150) educationLevel?: string;
  @IsOptional() @IsString() @MaxLength(150) currentAffiliation?: string;
  @IsOptional() @IsString() @MaxLength(255) fieldOfStudy?: string;
  @IsOptional() @IsString() @MaxLength(255) pythonSkill?: string;
  @IsOptional() @IsString() @MaxLength(255) gitSkill?: string;
  @IsOptional() @IsString() @MaxLength(255) aiExperience?: string;
  @IsIn(["has_account", "no_account"]) githubAccountStatus: "has_account" | "no_account";
  @ValidateIf(o => o.githubAccountStatus === "has_account")
  @IsString() @Matches(GITHUB_USERNAME_PATTERN, { message: "Provide a GitHub username, without a URL or @ prefix" }) githubUsername?: string;
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
  @StrictBoolean()
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

export class CompleteOnboardingPreferencesDto extends OmitType(OnboardingPreferencesDto, ["preferredRole"] as const) {
  @IsIn(BUILD_DEPLOY_OPTIONS.map(option => option.value)) buildDeployAbility: BuildDeployAbility;
  @IsIn(MATCHING_ROLE_OPTIONS.map(option => option.value)) preferredRole: MatchingRole;
  @IsIn(MATCHING_SECTOR_OPTIONS.map(option => option.value)) firstChoiceSector: MatchingSector;
  @IsIn(MATCHING_SECTOR_OPTIONS.map(option => option.value)) backupSector: MatchingSector;
  @IsIn(MATCHING_TEAM_STATUS_OPTIONS.map(option => option.value)) teamStatus: MatchingTeamStatus;
  @IsBoolean() @StrictBoolean() matchingProfileConsent: boolean;
}

export class UpdateParticipantProgrammeDto {
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() @StrictBoolean() programmeOptedOut?: boolean;
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() @StrictBoolean() codeLabsCompleted?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class UpdateMatchingConsentDto {
  @IsBoolean() @StrictBoolean() consent: boolean;
}

export class CompleteOnboardingDto {
  @ApiProperty()
  @ValidateNested()
  @IsDefined()
  @Type(() => OnboardingProfileDto)
  profile: OnboardingProfileDto;

  @ApiProperty()
  @ValidateNested()
  @IsDefined()
  @Type(() => OnboardingSkillsDto)
  skills: OnboardingSkillsDto;

  @ApiProperty()
  @ValidateNested()
  @IsDefined()
  @Type(() => CompleteOnboardingPreferencesDto)
  preferences: CompleteOnboardingPreferencesDto;
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
