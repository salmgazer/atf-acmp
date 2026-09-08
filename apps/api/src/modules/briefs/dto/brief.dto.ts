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
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { BriefStatus } from "@/database/entities/brief.entity";

class ResourceDto {
  @IsString()
  name: string;

  @IsUrl()
  url: string;

  @IsString()
  type: string;
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
}

export class PaginatedBriefsDto {
  data: BriefResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
