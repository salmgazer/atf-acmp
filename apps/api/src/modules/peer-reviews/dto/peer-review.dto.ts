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
import { PeerReviewAssignmentStatus } from "@/database/entities/peer-review.entity";

// ============ Rubric DTOs ============

export class RubricCriterionLevelDto {
  @IsNumber()
  score: number;

  @IsString()
  label: string;

  @IsString()
  description: string;
}

export class RubricCriterionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @IsNumber()
  @Min(1)
  maxScore: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionLevelDto)
  levels?: RubricCriterionLevelDto[];
}

export class CreateRubricDto {
  @IsUUID()
  cohortId: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria: RubricCriterionDto[];
}

export class UpdateRubricDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria?: RubricCriterionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============ Assignment DTOs ============

export class AssignPeerReviewsDto {
  @IsUUID()
  cohortId: string;

  @IsUUID()
  stageId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  reviewsPerTeam: number;

  @IsDateString()
  dueDate: string;
}

// ============ Review Submission DTOs ============

export class ReviewScoreDto {
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

export class SubmitPeerReviewDto {
  @IsUUID()
  assignmentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewScoreDto)
  scores: ReviewScoreDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  overallComment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  improvements?: string[];

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsNumber()
  timeSpentMinutes?: number;
}

// ============ Query DTOs ============

export class PeerReviewQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  reviewerTeamId?: string;

  @IsOptional()
  @IsUUID()
  reviewedTeamId?: string;

  @IsOptional()
  @IsEnum(PeerReviewAssignmentStatus)
  status?: PeerReviewAssignmentStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

// ============ Admin DTOs ============

export class FlagReviewDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
