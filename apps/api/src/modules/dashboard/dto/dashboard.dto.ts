import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsString,
} from "class-validator";

export class DashboardQueryDto {
  @IsUUID()
  cohortId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

// ============ Response Types ============

export interface OverviewMetrics {
  totalTeams: number;
  activeTeams: number;
  submittedTeams: number;
  evaluatedTeams: number;
  disqualifiedTeams: number;
  totalParticipants: number;
  totalMentors: number;
  totalOrganizations: number;
  submissionRate: number;
  averageTeamSize: number;
  dropoutRate: number;
}

export interface TeamsByStatus {
  forming: number;
  active: number;
  submitted: number;
  evaluated: number;
  disqualified: number;
}

export interface TeamsByVertical {
  verticalId: string;
  verticalName: string;
  count: number;
  percentage: number;
}

export interface TeamsByCountry {
  country: string;
  count: number;
  percentage: number;
}

export interface TeamStatistics {
  byStatus: TeamsByStatus;
  byVertical: TeamsByVertical[];
  byCountry: TeamsByCountry[];
  teamSizeDistribution: Array<{ size: number; count: number }>;
  registrationTrend: Array<{ date: string; count: number }>;
}

export interface StageSubmissionStats {
  stageId: string;
  stageName: string;
  stageNumber: number;
  totalTeams: number;
  submitted: number;
  late: number;
  pending: number;
  submissionRate: number;
  averageScore: number | null;
}

export interface SubmissionStatistics {
  byStage: StageSubmissionStats[];
  overallSubmissionRate: number;
  lateSubmissionRate: number;
  submissionTrend: Array<{ date: string; count: number }>;
}

export interface EvaluationStatistics {
  totalEvaluated: number;
  pendingEvaluation: number;
  averageAIScore: number;
  averageHumanScore: number;
  averageFinalScore: number;
  scoreDistribution: Array<{ range: string; count: number }>;
  byStage: Array<{
    stageId: string;
    stageName: string;
    evaluated: number;
    averageScore: number;
  }>;
}

export interface PerformanceHeatmap {
  data: Array<{
    verticalId: string;
    verticalName: string;
    country: string;
    teamCount: number;
    averageScore: number;
    submissionRate: number;
  }>;
}
