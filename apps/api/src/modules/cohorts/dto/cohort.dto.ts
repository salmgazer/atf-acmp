import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
  ValidateNested,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CohortStatus } from "../../../database/entities/cohort.entity";

export class DeadlinesDto {
  @ApiPropertyOptional({ description: "Team formation end date (ISO 8601)" })
  @IsDateString()
  @IsOptional()
  teamFormationEnd?: string;

  @ApiPropertyOptional({ description: "Brief selection end date (ISO 8601)" })
  @IsDateString()
  @IsOptional()
  briefSelectionEnd?: string;

  @ApiPropertyOptional({ description: "Stage 1 end date (ISO 8601)" })
  @IsDateString()
  @IsOptional()
  stage1End?: string;

  @ApiPropertyOptional({ description: "Stage 2 end date (ISO 8601)" })
  @IsDateString()
  @IsOptional()
  stage2End?: string;

  @ApiPropertyOptional({ description: "Stage 3 end date (ISO 8601)" })
  @IsDateString()
  @IsOptional()
  stage3End?: string;

  @ApiPropertyOptional({ description: "Demo day date (ISO 8601)" })
  @IsDateString()
  @IsOptional()
  demoDay?: string;
}

export class StageNamesDto {
  @ApiPropertyOptional({ description: "Custom name for Stage 1" })
  @IsString()
  @IsOptional()
  stage1?: string;

  @ApiPropertyOptional({ description: "Custom name for Stage 2" })
  @IsString()
  @IsOptional()
  stage2?: string;

  @ApiPropertyOptional({ description: "Custom name for Stage 3" })
  @IsString()
  @IsOptional()
  stage3?: string;

  @ApiPropertyOptional({ description: "Custom name for Demo Day" })
  @IsString()
  @IsOptional()
  demoDay?: string;
}

export class RubricCriteriaDto {
  @ApiProperty({ description: "Criterion name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: "Weight percentage (0-100)" })
  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @ApiPropertyOptional({ description: "Criterion description" })
  @IsString()
  @IsOptional()
  description?: string;
}

export class RubricConfigDto {
  @ApiProperty({ type: [RubricCriteriaDto] })
  @ValidateNested({ each: true })
  @Type(() => RubricCriteriaDto)
  @IsArray()
  criteria: RubricCriteriaDto[];
}

export class CreateCohortDto {
  @ApiProperty({ description: "Cohort name", example: "AI Challenge 2026" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: "Cohort description" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: "Minimum team size", default: 3 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  teamSizeMin?: number;

  @ApiPropertyOptional({ description: "Maximum team size", default: 5 })
  @IsNumber()
  @Min(1)
  @Max(15)
  @IsOptional()
  teamSizeMax?: number;

  @ApiPropertyOptional({ type: DeadlinesDto })
  @ValidateNested()
  @Type(() => DeadlinesDto)
  @IsOptional()
  deadlines?: DeadlinesDto;

  @ApiPropertyOptional({ type: StageNamesDto, description: "Custom stage names" })
  @ValidateNested()
  @Type(() => StageNamesDto)
  @IsOptional()
  stageNames?: StageNamesDto;

  @ApiPropertyOptional({ type: RubricConfigDto })
  @ValidateNested()
  @Type(() => RubricConfigDto)
  @IsOptional()
  rubric?: RubricConfigDto;

  @ApiPropertyOptional({ description: "List of participating countries", type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countries?: string[];

  @ApiPropertyOptional({ description: "List of verticals/sectors", type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  verticals?: string[];

  @ApiPropertyOptional({ description: "Maximum briefs per cohort", default: 50 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  briefCap?: number;

  @ApiPropertyOptional({ description: "Maximum teams per brief", default: 25 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTeamsPerBrief?: number;

  @ApiPropertyOptional({ description: "Default payment rate per mentor session", default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sessionRate?: number;
}

export class UpdateCohortDto extends PartialType(CreateCohortDto) {}

export class UpdateCohortStatusDto {
  @ApiProperty({ enum: CohortStatus, description: "New cohort status" })
  @IsEnum(CohortStatus)
  status: CohortStatus;
}

export class CohortQueryDto {
  @ApiPropertyOptional({ enum: CohortStatus, description: "Filter by status" })
  @IsEnum(CohortStatus)
  @IsOptional()
  status?: CohortStatus;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class CohortResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: CohortStatus })
  status: CohortStatus;

  @ApiProperty()
  teamSizeMin: number;

  @ApiProperty()
  teamSizeMax: number;

  @ApiProperty()
  deadlines: DeadlinesDto;

  @ApiPropertyOptional()
  rubric?: RubricConfigDto;

  @ApiProperty({ type: [String] })
  countries: string[];

  @ApiProperty({ type: [String] })
  verticals: string[];

  @ApiProperty()
  briefCap: number;

  @ApiProperty()
  maxTeamsPerBrief: number;

  @ApiPropertyOptional()
  sessionRate?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedCohortsResponseDto {
  @ApiProperty({ type: [CohortResponseDto] })
  data: CohortResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
