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

// ============ Stage DTOs ============

export class CreateStageDto {
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
  allowLateSubmissions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercentage?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateStageDto {
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
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLateSubmissions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercentage?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

// ============ Submission DTOs ============

export class FileUrlDto {
  @IsString()
  name: string;

  @IsUrl()
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
  @IsUrl()
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
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
  @IsUrl()
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
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
  @Type(() => Boolean)
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
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
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
  githubUrl?: string;
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
  version: number;
  lastSavedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  stage?: StageResponseDto;
  team?: {
    id: string;
    name: string;
  };
}

export class SubmissionStatsDto {
  stageId: string;
  stageName: string;
  total: number;
  draft: number;
  submitted: number;
  late: number;
  evaluated: number;
  pending: number;
}
