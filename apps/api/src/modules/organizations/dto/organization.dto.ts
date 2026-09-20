import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsEnum,
  MaxLength,
  MinLength,
  IsArray,
  ValidateNested,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
import { OrganizationStatus } from "@/database/entities/organization.entity";

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;
}

export class ApproveOrganizationDto {
  @IsOptional()
  @IsString()
  approvedBy?: string;
}

export class RejectOrganizationDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsString()
  rejectedBy?: string;
}

export class OrganizationQueryDto {
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class OrganizationResponseDto {
  id: string;
  name: string;
  email: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  status: OrganizationStatus;
  isActive: boolean;
  approvedAt?: Date;
  rejectionReason?: string;
  cohortId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedOrganizationsDto {
  data: OrganizationResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============ Bulk Import DTOs ============

export class BulkImportOrganizationRowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;
}

export class BulkImportOrganizationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportOrganizationRowDto)
  organizations: BulkImportOrganizationRowDto[];

  @IsOptional()
  @IsUUID()
  cohortId?: string;
}

export class ImportResultDto {
  success: boolean;
  email: string;
  name: string;
  error?: string;
  organizationId?: string;
}

export class BulkImportResultDto {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: ImportResultDto[];
}

// ============ Invite DTOs ============

export class SendInviteDto {
  @IsOptional()
  @IsString()
  customMessage?: string;
}

export class BulkSendInvitesDto {
  @IsArray()
  @IsUUID("4", { each: true })
  organizationIds: string[];

  @IsOptional()
  @IsString()
  customMessage?: string;
}

export class InviteResultDto {
  organizationId: string;
  email: string;
  success: boolean;
  error?: string;
}

export class BulkInviteResultDto {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: InviteResultDto[];
}
