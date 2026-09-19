import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  MaxLength,
  MinLength,
  IsNumber,
  IsUrl,
  ValidateNested,
  IsEmail,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { BriefStatus } from "@/database/entities/brief.entity";

class ResourceDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsString()
  type: string;
}

class SecondaryContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

class ScoringAnswersDto {
  @IsOptional()
  @IsString()
  q1?: string;

  @IsOptional()
  @IsString()
  q1_text?: string;

  @IsOptional()
  @IsString()
  q2?: string;

  @IsOptional()
  @IsString()
  q2_text?: string;

  @IsOptional()
  @IsString()
  q3?: string;

  @IsOptional()
  @IsString()
  q3_text?: string;

  @IsOptional()
  @IsString()
  q4?: string;

  @IsOptional()
  @IsString()
  q4_text?: string;

  @IsOptional()
  @IsString()
  q5?: string;

  @IsOptional()
  @IsString()
  q5_text?: string;

  @IsOptional()
  @IsString()
  q6?: string;

  @IsOptional()
  @IsString()
  q6_text?: string;

  @IsOptional()
  @IsString()
  q7?: string;

  @IsOptional()
  @IsString()
  q7_text?: string;

  @IsOptional()
  @IsString()
  q8?: string;

  @IsOptional()
  @IsString()
  q8_text?: string;
}

export class CreateBriefDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  description: string;

  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  problemStatement: string;

  @IsString()
  @MinLength(50)
  @MaxLength(3000)
  expectedOutcomes: string;

  @IsUUID()
  cohortId: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceDto)
  resources?: ResourceDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxTeams?: number;

  // Fields from onboard-organization form
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  whatChanges?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  affectedCount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  dataDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dataAccess?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryContactDto)
  secondaryContact?: SecondaryContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScoringAnswersDto)
  scoringAnswers?: ScoringAnswersDto;
}

export class UpdateBriefDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  problemStatement?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(3000)
  expectedOutcomes?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceDto)
  resources?: ResourceDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxTeams?: number;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  // Fields from onboard-organization form
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  whatChanges?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  affectedCount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  dataDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dataAccess?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryContactDto)
  secondaryContact?: SecondaryContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScoringAnswersDto)
  scoringAnswers?: ScoringAnswersDto;
}

export class SubmitBriefDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  submissionNotes?: string;
}

export class ReviewBriefDto {
  @IsEnum(["approved", "rejected", "revision_requested"])
  action: "approved" | "rejected" | "revision_requested";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

export class StaffUpdateBriefDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  problemStatement?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(3000)
  expectedOutcomes?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceDto)
  resources?: ResourceDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxTeams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  editComment?: string;

  // Fields from onboard-organization form
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  whatChanges?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  affectedCount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  dataDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dataAccess?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryContactDto)
  secondaryContact?: SecondaryContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScoringAnswersDto)
  scoringAnswers?: ScoringAnswersDto;
}

export class RestoreRevisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class BriefQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsEnum(BriefStatus)
  status?: BriefStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: "priority" | "fitScore" | "impactScore" | "createdAt" | "updatedAt";

  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc";
}

export class BriefResponseDto {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  expectedOutcomes: string;
  status: BriefStatus;
  cohortId: string;
  organizationId: string;
  verticalId?: string;
  vertical?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  tags: string[];
  resources?: Array<{ name: string; url: string; type: string }>;
  videoUrl?: string;
  imageUrls: string[];
  maxTeams: number;
  teamsCount: number;
  reviewFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  revisionCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Fields from onboard-organization form
  whatChanges?: string;
  affectedCount?: string;
  dataDescription?: string;
  dataAccess?: string;
  secondaryContact?: {
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  scoringAnswers?: {
    q1?: string;
    q1_text?: string;
    q2?: string;
    q2_text?: string;
    q3?: string;
    q3_text?: string;
    q4?: string;
    q4_text?: string;
    q5?: string;
    q5_text?: string;
    q6?: string;
    q6_text?: string;
    q7?: string;
    q7_text?: string;
    q8?: string;
    q8_text?: string;
  };
  // Scoring results
  fitScore?: number;
  fitBand?: string;
  scoreOverride?: string;
  depthScore?: number;
  breadthScore?: number;
  impactScore?: number;
  impactBand?: string;
  priorityScore?: number;
}

export class PaginatedBriefsDto {
  data: BriefResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
