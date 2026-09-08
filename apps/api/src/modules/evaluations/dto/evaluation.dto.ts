import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { EvaluationJobStatus } from "@/database/entities/evaluation.entity";

// ============ Trigger DTOs ============

export class TriggerEvaluationDto {
  @IsUUID()
  cohortId: string;

  @IsUUID()
  stageId: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  teamIds?: string[]; // Optional: specific teams to evaluate
}

export class TriggerSingleEvaluationDto {
  @IsUUID()
  teamId: string;

  @IsUUID()
  stageId: string;
}

// ============ Human Scoring DTOs ============

export class HumanScoreItemDto {
  @IsString()
  criterionId: string;

  @IsString()
  criterionName: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  maxScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SubmitHumanScoreDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HumanScoreItemDto)
  scores: HumanScoreItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}

// ============ Query DTOs ============

export class EvaluationQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  needsHumanReview?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublished?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

export class JobQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsEnum(EvaluationJobStatus)
  status?: EvaluationJobStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

// ============ Configuration DTOs ============

export class UpdateAIWeightDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  aiWeight: number;
}

export class PublishEvaluationsDto {
  @IsArray()
  @IsUUID("4", { each: true })
  evaluationIds: string[];
}

// ============ Response Types ============

export interface QueueStatusResponse {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface EvaluationStatsResponse {
  totalTeams: number;
  evaluated: number;
  pending: number;
  failed: number;
  averageScore: number;
  averageProcessingTime: number;
}
