import { StrictBoolean } from "@/common/decorators/query-value.decorator";
import { IsInt as QueryIsInt, Min as QueryMin, Max as QueryMax } from "class-validator";
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
  @StrictBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @StrictBoolean()
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
  @StrictBoolean()
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
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
  limit?: number;

  @Type(() => Number)
  @IsOptional()
  @QueryIsInt()
  @QueryMin(0)
  @QueryMax(1000000)
  offset?: number;
}

export class ParticipantAnnouncementQueryDto {
  @IsUUID()
  @IsOptional()
  cohortId?: string;

  @Type(() => Number)
  @IsOptional()
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
  limit?: number;

  @Type(() => Number)
  @IsOptional()
  @QueryIsInt()
  @QueryMin(0)
  @QueryMax(1000000)
  offset?: number;
}
