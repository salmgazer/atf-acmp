import { IsUUID, IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class LeaderboardQueryDto {
  @IsUUID()
  cohortId: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  verticalId: string;
  verticalName: string;
  country: string | null;
  memberCount: number;
  finalScore: number;
  stageScores: Array<{
    stageId: string;
    stageName: string;
    score: number | null;
  }>;
  evaluatedAt: Date | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    cohortId: string;
    cohortName: string;
    isPublic: boolean;
    showScores: boolean;
  };
  filters: {
    verticalId?: string;
    country?: string;
    stageId?: string;
  };
}

export class UpdateLeaderboardConfigDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  showScores?: boolean;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  contributingStageIds?: string[];
}

export interface LeaderboardExportEntry {
  rank: number;
  teamName: string;
  vertical: string;
  country: string;
  memberCount: number;
  finalScore: number;
  [key: string]: string | number; // Dynamic stage scores
}
