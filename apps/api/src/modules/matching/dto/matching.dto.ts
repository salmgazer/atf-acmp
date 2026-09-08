import { IsUUID, IsOptional, IsNumber, Min, Max, IsBoolean, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Configuration options for the matching algorithm
 */
export class MatchingConfigDto {
  @ApiPropertyOptional({
    description: "Weight for first choice brief ranking (0-1)",
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  firstChoiceWeight?: number = 1.0;

  @ApiPropertyOptional({
    description: "Weight for second choice brief ranking (0-1)",
    default: 0.8,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  secondChoiceWeight?: number = 0.8;

  @ApiPropertyOptional({
    description: "Weight for third choice brief ranking (0-1)",
    default: 0.6,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  thirdChoiceWeight?: number = 0.6;

  @ApiPropertyOptional({
    description: "Weight for fourth choice brief ranking (0-1)",
    default: 0.4,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fourthChoiceWeight?: number = 0.4;

  @ApiPropertyOptional({
    description: "Weight for fifth choice brief ranking (0-1)",
    default: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fifthChoiceWeight?: number = 0.2;

  @ApiPropertyOptional({
    description: "Weight for vertical preference matching (0-1)",
    default: 0.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  verticalWeight?: number = 0.5;

  @ApiPropertyOptional({
    description: "Weight for skill overlap between team members (0-1)",
    default: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  skillOverlapWeight?: number = 0.3;

  @ApiPropertyOptional({
    description: "Prioritize teams with fewer assignments (balance distribution)",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  balanceDistribution?: boolean = true;

  @ApiPropertyOptional({
    description: "Maximum teams per brief (override brief.maxTeams)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTeamsPerBrief?: number;
}

export class RunMatchingDto {
  @ApiPropertyOptional({ type: MatchingConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchingConfigDto)
  config?: MatchingConfigDto;

  @ApiPropertyOptional({
    description: "Only match specific team IDs",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  teamIds?: string[];

  @ApiPropertyOptional({
    description: "Only match to specific brief IDs",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  briefIds?: string[];
}

export class ManualAssignmentDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiProperty()
  @IsUUID()
  briefId: string;
}

export class FinalizeMatchingDto {
  @ApiPropertyOptional({
    description: "Override with manual assignments",
    type: [ManualAssignmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAssignmentDto)
  overrides?: ManualAssignmentDto[];

  @ApiPropertyOptional({
    description: "Team IDs to exclude from finalization",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  excludeTeamIds?: string[];
}

/**
 * Individual team-brief match result
 */
export class MatchResultDto {
  @ApiProperty()
  teamId: string;

  @ApiProperty()
  teamName: string;

  @ApiProperty()
  briefId: string;

  @ApiProperty()
  briefTitle: string;

  @ApiProperty()
  organizationName: string;

  @ApiProperty({
    description: "Match score (0-100)",
  })
  score: number;

  @ApiProperty({
    description: "Breakdown of score components",
  })
  scoreBreakdown: {
    rankingScore: number;
    verticalScore: number;
    skillScore: number;
    interestScore: number;
  };

  @ApiProperty({
    description: "Team ranking position for this brief (1-5, or null if not ranked)",
  })
  rankPosition: number | null;

  @ApiProperty({
    description: "Whether the team's vertical preference matches",
  })
  verticalMatch: boolean;

  @ApiProperty({
    description: "Number of overlapping skills between team and brief requirements",
  })
  skillOverlap: number;

  @ApiProperty({
    description: "Number of overlapping interests between team and brief requirements",
  })
  interestOverlap: number;
}

/**
 * Overall matching statistics
 */
export class MatchingStatsDto {
  @ApiProperty()
  totalTeams: number;

  @ApiProperty()
  matchedTeams: number;

  @ApiProperty()
  unmatchedTeams: number;

  @ApiProperty()
  totalBriefs: number;

  @ApiProperty()
  briefsWithTeams: number;

  @ApiProperty()
  briefsAtCapacity: number;

  @ApiProperty({
    description: "Average match score across all matches",
  })
  averageScore: number;

  @ApiProperty({
    description: "Percentage of teams that got their first choice",
  })
  firstChoicePercentage: number;

  @ApiProperty({
    description: "Percentage of teams that got top 3 choice",
  })
  topThreePercentage: number;

  @ApiProperty({
    description: "Teams matched to a ranked brief",
  })
  matchedToRankedBrief: number;

  @ApiProperty({
    description: "Teams matched to unranked brief (fallback)",
  })
  matchedToUnrankedBrief: number;
}

/**
 * Full matching preview response
 */
export class MatchingPreviewDto {
  @ApiProperty()
  cohortId: string;

  @ApiProperty()
  cohortName: string;

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty({ type: MatchingStatsDto })
  statistics: MatchingStatsDto;

  @ApiProperty({ type: [MatchResultDto] })
  matches: MatchResultDto[];

  @ApiProperty({ type: [String] })
  unmatchedTeamIds: string[];

  @ApiProperty({ type: MatchingConfigDto })
  configUsed: MatchingConfigDto;

  @ApiProperty({
    description: "Warnings or issues encountered during matching",
  })
  warnings: string[];
}

/**
 * Brief capacity summary for matching
 */
export class BriefCapacityDto {
  @ApiProperty()
  briefId: string;

  @ApiProperty()
  briefTitle: string;

  @ApiProperty()
  organizationName: string;

  @ApiProperty()
  verticalName: string | null;

  @ApiProperty()
  maxTeams: number;

  @ApiProperty()
  currentTeams: number;

  @ApiProperty()
  previewTeams: number;

  @ApiProperty()
  availableSlots: number;
}

/**
 * Team matching status
 */
export class TeamMatchStatusDto {
  @ApiProperty()
  teamId: string;

  @ApiProperty()
  teamName: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  hasPreferences: boolean;

  @ApiProperty({ type: [String] })
  rankedBriefIds: string[];

  @ApiProperty()
  currentBriefId: string | null;

  @ApiProperty()
  previewBriefId: string | null;

  @ApiProperty()
  previewScore: number | null;
}
