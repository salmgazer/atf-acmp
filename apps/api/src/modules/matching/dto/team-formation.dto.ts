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
 * Skill profile classification
 */
export type SkillProfile = "technical" | "non-technical" | "hybrid";

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
    description: "Target ratio of technical members in a team (0-1, default 0.5 for 50/50)",
    default: 0.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  targetTechRatio?: number = 0.5;

  @ApiPropertyOptional({
    description: "Weight for tech/non-tech balance in scoring (0-1)",
    default: 0.25,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  techBalanceWeight?: number = 0.25;

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

  @ApiPropertyOptional({
    description: "Use brief-centric round-robin assignment (assign briefs to teams, not teams to briefs)",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useBriefCentricAssignment?: boolean = true;
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

  @ApiPropertyOptional({ description: "Participant ID to be team co-lead" })
  @IsOptional()
  @IsUUID("4")
  coLeadParticipantId?: string;
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
    isProposedCoLead: boolean;
    skillProfile: SkillProfile;
  }>;

  @ApiProperty({ description: "Proposed team lead participant ID" })
  leadParticipantId: string;

  @ApiProperty({ description: "Proposed team co-lead participant ID" })
  coLeadParticipantId: string;

  @ApiProperty({ description: "Team compatibility score (0-100)" })
  compatibilityScore: number;

  @ApiProperty({ description: "Score breakdown" })
  scoreBreakdown: {
    skillScore: number;
    interestScore: number;
    verticalScore: number;
    countryScore: number;
    techBalanceScore: number;
    total: number;
  };

  @ApiProperty({ description: "Countries represented in the team" })
  countries: string[];

  @ApiProperty({ description: "Whether team is cross-country" })
  isCrossCountry: boolean;

  @ApiProperty({ description: "Combined vertical preferences" })
  verticalPreferences: string[];

  @ApiProperty({ description: "Tech/non-tech skill balance stats" })
  skillBalance: {
    techCount: number;
    nonTechCount: number;
    techRatio: number;
    profiles: Record<SkillProfile, number>;
  };

  @ApiPropertyOptional({ description: "Assigned brief ID (for brief-centric formation)" })
  assignedBriefId?: string;

  @ApiPropertyOptional({ description: "Assigned brief title" })
  assignedBriefTitle?: string;

  @ApiPropertyOptional({ description: "Assigned brief vertical ID" })
  assignedVerticalId?: string;

  @ApiPropertyOptional({ description: "Assigned brief vertical name" })
  assignedVerticalName?: string;
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
    skillProfile: SkillProfile;
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

  @ApiProperty({ 
    description: "Whether members will be added as PENDING (requiring team lead approval)",
    default: true,
  })
  addAsPending: boolean;

  @ApiProperty({ description: "Skill balance after adding proposed members" })
  skillBalanceAfter: {
    techCount: number;
    nonTechCount: number;
    techRatio: number;
  };
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

  @ApiProperty({ description: "Number of backfill members added as PENDING (needing approval)" })
  pendingMemberCount: number;
}

/**
 * Brief assignment statistics for round-robin approach
 */
export class BriefAssignmentStatsDto {
  @ApiProperty({ description: "Total approved briefs available" })
  totalApprovedBriefs: number;

  @ApiProperty({ description: "Briefs that received team assignments" })
  briefsAssigned: number;

  @ApiProperty({ description: "Briefs without teams (not enough participants)" })
  briefsWithoutTeams: number;

  @ApiProperty({ description: "Existing teams without briefs that got assigned" })
  existingTeamsAssignedBriefs: number;

  @ApiProperty({ description: "Briefs assigned by vertical" })
  assignmentsByVertical: Record<string, number>;
}

/**
 * Skill balance statistics
 */
export class SkillBalanceStatsDto {
  @ApiProperty({ description: "Total technical participants" })
  totalTechnical: number;

  @ApiProperty({ description: "Total non-technical participants" })
  totalNonTechnical: number;

  @ApiProperty({ description: "Total hybrid participants (both tech and non-tech skills)" })
  totalHybrid: number;

  @ApiProperty({ description: "Average tech ratio across proposed teams (0-1)" })
  averageTechRatio: number;

  @ApiProperty({ description: "Teams with good balance (40-60% tech)" })
  wellBalancedTeamCount: number;

  @ApiProperty({ description: "Teams that are tech-heavy (>60% tech)" })
  techHeavyTeamCount: number;

  @ApiProperty({ description: "Teams that are non-tech-heavy (>60% non-tech)" })
  nonTechHeavyTeamCount: number;
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

  @ApiProperty({ description: "Skill balance statistics", type: SkillBalanceStatsDto })
  skillBalanceStats: SkillBalanceStatsDto;

  @ApiProperty({ description: "Brief assignment statistics (for round-robin mode)", type: BriefAssignmentStatsDto })
  briefAssignmentStats: BriefAssignmentStatsDto;
}

/**
 * Proposed brief assignment to an existing team without a brief
 */
export class ProposedBriefAssignmentDto {
  @ApiProperty({ description: "Team ID" })
  teamId: string;

  @ApiProperty({ description: "Team name" })
  teamName: string;

  @ApiProperty({ description: "Brief ID to assign" })
  briefId: string;

  @ApiProperty({ description: "Brief title" })
  briefTitle: string;

  @ApiProperty({ description: "Vertical ID" })
  verticalId: string;

  @ApiProperty({ description: "Vertical name" })
  verticalName: string;

  @ApiProperty({ description: "Match score based on team's collective interests (0-100)" })
  matchScore: number;

  @ApiProperty({ description: "Current team member count" })
  teamMemberCount: number;

  @ApiProperty({ description: "Team's collective vertical preferences" })
  teamVerticalPreferences: string[];

  @ApiProperty({ description: "Number of team members who had this brief in their rankings" })
  membersWithBriefRanking: number;
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
    description: "Proposed backfills for existing undersized teams (members added as PENDING)" 
  })
  proposedBackfills: ProposedBackfillDto[];

  @ApiProperty({ 
    type: [ProposedBriefAssignmentDto],
    description: "Proposed brief assignments to existing teams without briefs" 
  })
  proposedBriefAssignments: ProposedBriefAssignmentDto[];

  @ApiProperty({ type: [ProposedTeamDto] })
  proposedTeams: ProposedTeamDto[];

  @ApiProperty({
    description: "Participant IDs that could not be assigned to a team",
    type: [String],
  })
  unassignedParticipantIds: string[];

  @ApiProperty({
    description: "Brief IDs that could not be assigned to a team (not enough participants)",
    type: [String],
  })
  unassignedBriefIds: string[];

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

  @ApiProperty({ description: "Skill profile classification (technical, non-technical, hybrid)" })
  skillProfile: SkillProfile;

  @ApiProperty({ description: "Number of technical skills" })
  techSkillCount: number;

  @ApiProperty({ description: "Number of non-technical skills" })
  nonTechSkillCount: number;
}
