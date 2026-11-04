import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { OrganizationStatus } from "@/database/entities/organization.entity";

export class ResendPartnerInvitesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique()
  @IsUUID("4", { each: true })
  organizationIds: string[];
}

export class ResendEligiblePartnerInvitesDto {
  @IsUUID() cohortId: string;
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsEnum(OrganizationStatus) status?: OrganizationStatus;
  @IsOptional() @IsString() @MaxLength(255) country?: string;
}

export interface PartnerInviteProgress {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  failures: { organizationId: string; email: string; message: string }[];
}

export interface PartnerInviteBatch extends PartnerInviteProgress {
  id: string;
  state: "queued" | "active" | "completed" | "failed";
  error?: string;
}
