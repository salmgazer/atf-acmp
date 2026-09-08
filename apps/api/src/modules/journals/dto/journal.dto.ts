import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { JournalEntryStatus } from "@/database/entities/journal.entity";

export class CreateJournalEntryDto {
  @IsNumber()
  @Min(1)
  weekNumber: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  challenges?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nextWeekGoals?: string[];

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;
}

export class UpdateJournalEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  challenges?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nextWeekGoals?: string[];

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;
}

export class JournalQueryDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weekNumber?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fromWeek?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  toWeek?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

export class JournalEntryResponseDto {
  id: string;
  teamId: string;
  cohortId: string;
  authorId: string;
  weekNumber: number;
  title?: string;
  content: string;
  highlights?: string[];
  challenges?: string[];
  nextWeekGoals?: string[];
  status: JournalEntryStatus;
  editableUntil: Date;
  canEdit: boolean;
  hoursRemainingToEdit: number;
  lastEditedAt?: Date;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  team?: {
    id: string;
    name: string;
  };
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}
