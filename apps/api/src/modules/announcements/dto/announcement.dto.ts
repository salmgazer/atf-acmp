import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsBoolean,
  IsDateString,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import {
  AnnouncementAudience,
  AnnouncementStatus,
} from "@/database/entities/announcement.entity";

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsEnum(AnnouncementAudience)
  @IsOptional()
  audience?: AnnouncementAudience;

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  audienceValue?: string[];

  @IsUUID()
  cohortId: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  publishImmediately?: boolean;
}

export class UpdateAnnouncementDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  content?: string;

  @IsEnum(AnnouncementAudience)
  @IsOptional()
  audience?: AnnouncementAudience;

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  audienceValue?: string[];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsEnum(AnnouncementStatus)
  @IsOptional()
  status?: AnnouncementStatus;
}

export class AnnouncementQueryDto {
  @IsUUID()
  cohortId: string;

  @IsEnum(AnnouncementStatus)
  @IsOptional()
  status?: AnnouncementStatus;

  @IsEnum(AnnouncementAudience)
  @IsOptional()
  audience?: AnnouncementAudience;

  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsOptional()
  offset?: number;
}

export class ParticipantAnnouncementQueryDto {
  @IsUUID()
  @IsOptional()
  cohortId?: string;

  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsOptional()
  offset?: number;
}
