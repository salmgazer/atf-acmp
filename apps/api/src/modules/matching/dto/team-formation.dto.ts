import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * How to select team lead during auto-formation
 */
export enum LeadSelectionStrategy {
  /** Randomly select from team members */
  RANDOM = "random",
  /** Select participant with most complete preferences */
  MOST_PREFERENCES = "most_preferences",
  /** Select participant with most skills */
  MOST_SKILLS = "most_skills",
  /** Select participant who registered first */
  FIRST_REGISTERED = "first_registered",
}

/**
 * Configuration for auto team formation algorithm
 */
export class TeamFormationConfigDto {
  @ApiPropertyOptional({
    description: "Weight for skill compatibility (0-1)",
    default: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  skillWeight?: number = 0.3;

  @ApiPropertyOptional({
    description: "Weight for interest compatibility (0-1)",
    default: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  interestWeight?: number = 0.2;

  @ApiPropertyOptional({
    description: "Weight for vertical preference alignment (0-1)",
    default: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  verticalWeight?: number = 0.3;

  @ApiPropertyOptional({
    description: "Weight for country preference (same country bonus) (0-1)",
    default: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  countryWeight?: number = 0.2;

  @ApiPropertyOptional({
    description: "Prioritize diversity of skills within a team",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  prioritizeSkillDiversity?: boolean = true;

  @ApiPropertyOptional({
    description: "Strategy for selecting team lead",
    enum: LeadSelectionStrategy,
    default: LeadSelectionStrategy.MOST_PREFERENCES,
  })
  @IsOptional()
  @IsEnum(LeadSelectionStrategy)
  leadSelectionStrategy?: LeadSelectionStrategy = LeadSelectionStrategy.MOST_PREFERENCES;

  @ApiPropertyOptional({
    description: "Override team size (min)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  teamSizeMin?: number;

  @ApiPropertyOptional({
    description: "Override team size (max)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  teamSizeMax?: number;

  @ApiPropertyOptional({
    description: "Allow cross-country teams even for participants who prefer same country",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceCrossCountry?: boolean = false;
}

export class RunTeamFormationDto {
  @ApiPropertyOptional({ type: TeamFormationConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeamFormationConfigDto)
  config?: TeamFormationConfigDto;

  @ApiPropertyOptional({
    description: "Only form teams from specific participant IDs",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  participantIds?: string[];
}

export class ManualTeamAssignmentDto {
  @ApiProperty({ description: "Participant IDs to group into a team" })
  @IsArray()
  @IsUUID("4", { each: true })
  participantIds: string[];

  @ApiPropertyOptional({ description: "Optional team name" })
  @IsOptional()
  teamName?: string;

  @ApiPropertyOptional({ description: "Participant ID to be team lead" })
  @IsOptional()
  @IsUUID("4")
  leadParticipantId?: string;
}

export class FinalizeTeamFormationDto {
  @ApiPropertyOptional({
    description: "Manual team assignments (override algorithm)",
    type: [ManualTeamAssignmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualTeamAssignmentDto)
  manualTeams?: ManualTeamAssignmentDto[];

  @ApiPropertyOptional({
    description: "Participant IDs to exclude from formation",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  excludeParticipantIds?: string[];
}

/**
 * Proposed team in the preview
 */
export class ProposedTeamDto {
  @ApiProperty({ description: "Temporary ID for the proposed team" })
  proposedTeamId: string;

  @ApiProperty({ description: "Suggested team name" })
  suggestedName: string;

  @ApiProperty({ description: "Participant IDs in this team" })
  participantIds: string[];

  @ApiProperty({ description: "Participant details" })
  participants: Array<{
    id: string;
    participantId: string;
    firstName: string;
    lastName: string;
    country: string;
    skills: string[];
    interests: string[];
    isProposedLead: boolean;
  }>;

  @ApiProperty({ description: "Proposed team lead participant ID" })
  leadParticipantId: string;

  @ApiProperty({ description: "Team compatibility score (0-100)" })
  compatibilityScore: number;

  @ApiProperty({ description: "Score breakdown" })
  scoreBreakdown: {
    skillScore: number;
    interestScore: number;
    verticalScore: number;
    countryScore: number;
  };

  @ApiProperty({ description: "Countries represented in the team" })
  countries: string[];

  @ApiProperty({ description: "Whether team is cross-country" })
  isCrossCountry: boolean;

  @ApiProperty({ description: "Combined vertical preferences" })
  verticalPreferences: string[];
}

/**
 * Proposed backfill assignment for an existing undersized team
 */
export class ProposedBackfillDto {
  @ApiProperty({ description: "Existing team ID to backfill" })
  teamId: string;

  @ApiProperty({ description: "Existing team name" })
  teamName: string;

  @ApiProperty({ description: "Current member count before backfill" })
  currentMemberCount: number;

  @ApiProperty({ description: "Max team size (target)" })
  targetSize: number;

  @ApiProperty({ description: "Participant IDs to add to this team" })
  participantIdsToAdd: string[];

  @ApiProperty({ description: "Participant details to add" })
  participantsToAdd: Array<{
    id: string;
    participantId: string;
    firstName: string;
    lastName: string;
    country: string;
    skills: string[];
    interests: string[];
  }>;

  @ApiProperty({ description: "Compatibility score of proposed additions (0-100)" })
  compatibilityScore: number;

  @ApiProperty({ description: "Brief ID the team is working on (if assigned)" })
  briefId: string | null;

  @ApiProperty({ description: "Vertical IDs the team is aligned with" })
  verticalPreferences: string[];

  @ApiProperty({ description: "Countries currently in the team" })
  existingCountries: string[];

  @ApiProperty({ description: "Whether backfill introduces cross-country members" })
  introducesCrossCountry: boolean;
}

/**
 * Backfill statistics
 */
export class BackfillStatsDto {
  @ApiProperty({ description: "Number of existing teams that are undersized" })
  undersizedTeamCount: number;

  @ApiProperty({ description: "Number of teams that will receive backfills" })
  teamsToBackfillCount: number;

  @ApiProperty({ description: "Total participants to be added via backfill" })
  participantsToBackfillCount: number;

  @ApiProperty({ description: "Average compatibility score of backfill assignments" })
  averageBackfillCompatibility: number;

  @ApiProperty({ description: "Teams that remain undersized after backfill (not enough compatible participants)" })
  teamsStillUndersizedCount: number;
}

/**
 * Team formation statistics
 */
export class TeamFormationStatsDto {
  @ApiProperty()
  totalEligibleParticipants: number;

  @ApiProperty()
  participantsWithPreferences: number;

  @ApiProperty()
  participantsWithoutPreferences: number;

  @ApiProperty()
  crossCountryWillingCount: number;

  @ApiProperty()
  sameCountryPreferredCount: number;

  @ApiProperty()
  proposedTeamCount: number;

  @ApiProperty()
  averageTeamSize: number;

  @ApiProperty()
  averageCompatibilityScore: number;

  @ApiProperty()
  crossCountryTeamCount: number;

  @ApiProperty()
  sameCountryTeamCount: number;

  @ApiProperty()
  unassignedParticipantCount: number;

  @ApiProperty({ description: "Participants per country breakdown" })
  countryDistribution: Record<string, number>;

  @ApiProperty({ description: "Backfill statistics", type: BackfillStatsDto })
  backfillStats: BackfillStatsDto;
}

/**
 * Full team formation preview response
 */
export class TeamFormationPreviewDto {
  @ApiProperty()
  cohortId: string;

  @ApiProperty()
  cohortName: string;

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty({ type: TeamFormationStatsDto })
  statistics: TeamFormationStatsDto;

  @ApiProperty({ 
    type: [ProposedBackfillDto],
    description: "Proposed backfills for existing undersized teams (applied first)" 
  })
  proposedBackfills: ProposedBackfillDto[];

  @ApiProperty({ type: [ProposedTeamDto] })
  proposedTeams: ProposedTeamDto[];

  @ApiProperty({
    description: "Participant IDs that could not be assigned to a team",
    type: [String],
  })
  unassignedParticipantIds: string[];

  @ApiProperty({ type: TeamFormationConfigDto })
  configUsed: TeamFormationConfigDto;

  @ApiProperty({
    description: "Warnings or issues encountered during formation",
  })
  warnings: string[];
}

/**
 * Participant status for team formation
 */
export class ParticipantFormationStatusDto {
  @ApiProperty()
  participantId: string;

  @ApiProperty()
  participantDisplayId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  hasTeam: boolean;

  @ApiProperty()
  teamId: string | null;

  @ApiProperty()
  teamName: string | null;

  @ApiProperty()
  hasPreferences: boolean;

  @ApiProperty()
  crossCountryWilling: boolean;

  @ApiProperty()
  skillCount: number;

  @ApiProperty()
  interestCount: number;

  @ApiProperty()
  verticalPreferenceCount: number;
}
