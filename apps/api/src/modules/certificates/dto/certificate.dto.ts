import { IsUUID, IsOptional, IsEnum, IsArray, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { CertificateTier } from "@/database/entities/certificate.entity";

export class GenerateCertificatesDto {
  @IsUUID()
  cohortId: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  participantIds?: string[]; // If empty, generate for all eligible participants

  @IsOptional()
  @IsEnum(CertificateTier)
  overrideTier?: CertificateTier; // Override automatic tier assignment
}

export class CertificateQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsEnum(CertificateTier)
  tier?: CertificateTier;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class UpdateCertificateTierDto {
  @IsEnum(CertificateTier)
  tier: CertificateTier;
}

export interface TierThresholds {
  winner: { maxRank: number }; // e.g., rank 1-3 are winners
  excellence: { minScore: number }; // e.g., score >= 80
  completion: { minScore: number }; // e.g., score >= 50, submitted all stages
  participation: {}; // Everyone else who participated
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  winner: { maxRank: 3 },
  excellence: { minScore: 80 },
  completion: { minScore: 50 },
  participation: {},
};

export interface CertificateResponse {
  id: string;
  certificateId: string;
  tier: CertificateTier;
  status: string;
  participantName: string;
  teamName?: string;
  cohortName: string;
  verticalName?: string;
  finalScore?: number;
  rank?: number;
  pdfUrl?: string;
  verificationUrl?: string;
  generatedAt?: Date;
  downloadCount: number;
}

export interface GenerationResult {
  total: number;
  generated: number;
  failed: number;
  skipped: number;
  errors: Array<{ participantId: string; error: string }>;
}

export interface VerificationResponse {
  valid: boolean;
  certificate?: {
    certificateId: string;
    participantName: string;
    teamName?: string;
    cohortName: string;
    tier: CertificateTier;
    generatedAt?: Date;
    rank?: number;
  };
}
