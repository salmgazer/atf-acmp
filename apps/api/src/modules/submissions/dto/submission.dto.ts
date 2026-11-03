import { IsInt as QueryIsInt, Min as QueryMin, Max as QueryMax } from "class-validator";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  IsDateString,
  IsUrl,
  Min,
  Max,
  ValidateNested,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { StageType, SubmissionStatus, StageRequirements } from "@/database/entities/stage.entity";

export class EvaluationCriterionDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsString() description: string;
  @IsNumber() @Min(1) maxScore: number;
  @IsNumber() @Min(0) @Max(100) weight: number;
}

// ============ Stage DTOs ============

export class CreateStageDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EvaluationCriterionDto)
  evaluationCriteria?: EvaluationCriterionDto[];
  @IsUUID()
  cohortId: string;

  @IsNumber()
  @Min(1)
  number: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsEnum(StageType)
  type: StageType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsObject()
  requirements?: StageRequirements;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  allowLateSubmissions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercentage?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  unlocksMentorClaim?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  requiresAiEvaluation?: boolean;

  @IsOptional()
  @IsString()
  evaluationPrompt?: string;
}

export class UpdateStageDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EvaluationCriterionDto)
  evaluationCriteria?: EvaluationCriterionDto[];
  @IsOptional()
  @IsNumber()
  @Min(1)
  number?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsEnum(StageType)
  type?: StageType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsObject()
  requirements?: StageRequirements;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  allowLateSubmissions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercentage?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  unlocksMentorClaim?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  requiresAiEvaluation?: boolean;

  @IsOptional()
  @IsString()
  evaluationPrompt?: string;
}

// ============ Submission DTOs ============

export class FileUrlDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false, protocols: ["http", "https"], require_protocol: true })
  url: string;

  @IsString()
  type: string;

  @IsNumber()
  size: number;

  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

export class SaveSubmissionDraftDto {
  @IsUUID()
  stageId: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileUrlDto)
  fileUrls?: FileUrlDto[];

  @IsOptional()
  @IsString()
  videoUrl?: string;
}

export class SubmitSubmissionDto {
  @IsUUID()
  stageId: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileUrlDto)
  fileUrls?: FileUrlDto[];

  @IsOptional()
  @IsString()
  videoUrl?: string;
}

export class EvaluateSubmissionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  evaluationNotes?: string;

  @IsOptional()
  @IsObject()
  feedback?: {
    strengths?: string[];
    improvements?: string[];
    comments?: string;
  };
}

// ============ Query DTOs ============

export class StageQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  activeOnly?: boolean;
}

export class SubmissionQueryDto {
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(1000000)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
  limit?: number;
}

// ============ Response DTOs ============

export class StageResponseDto {
  id: string;
  cohortId: string;
  number: number;
  name: string;
  description?: string;
  instructions?: string;
  type: StageType;
  startDate?: Date;
  deadline: Date;
  requirements: StageRequirements;
  weightPercentage: number;
  isActive: boolean;
  allowLateSubmissions: boolean;
  latePenaltyPercentage: number;
  sortOrder: number;
  unlocksMentorClaim: boolean;
  requiresManualApproval: boolean;
  requiresAiEvaluation: boolean;
  evaluationPrompt?: string;
  isOpen: boolean;
  isPastDeadline: boolean;
  submissionCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SubmissionResponseDto {
  id: string;
  teamId: string;
  stageId: string;
  status: SubmissionStatus;
  content: Record<string, any>;
  fileUrls: FileUrlDto[];
  videoUrl?: string;
  submittedAt?: Date;
  submittedBy?: string;
  isLate: boolean;
  lateMinutes: number;
  score?: number;
  evaluatedAt?: Date;
  feedback?: {
    strengths?: string[];
    improvements?: string[];
    comments?: string;
  };
  // Approval fields
  approvedAt?: Date;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  version: number;
  lastSavedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  stage?: StageResponseDto;
  team?: {
    id: string;
    name: string;
    githubRepoUrl?: string;
  };
}

export class SubmissionStatsDto {
  stageId: string;
  stageName: string;
  total: number;
  draft: number;
  submitted: number;
  late: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  evaluated: number;
  pending: number;
}

// ============ Approval DTOs ============

export class ApproveSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalNotes?: string;
}

export class RejectSubmissionDto {
  @IsString()
  @MaxLength(2000)
  rejectionReason: string;
}

export class SubmissionApprovalQueryDto {
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(1000000)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
  limit?: number;
}
