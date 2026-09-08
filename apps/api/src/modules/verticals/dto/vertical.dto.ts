import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class CreateVerticalDto {
  @ApiProperty({ description: "Vertical/sector name", example: "Healthcare" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: "Vertical description" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: "Cohort ID this vertical belongs to" })
  @IsUUID()
  cohortId: string;

  @ApiPropertyOptional({ description: "Maximum briefs allowed", default: 10 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  briefCap?: number;

  @ApiPropertyOptional({ description: "Display order for sorting", default: 0 })
  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateVerticalDto extends PartialType(CreateVerticalDto) {
  // Remove cohortId from updates - vertical can't change cohort
  cohortId?: never;
}

export class VerticalQueryDto {
  @ApiPropertyOptional({ description: "Filter by cohort ID" })
  @IsUUID()
  @IsOptional()
  cohortId?: string;

  @ApiPropertyOptional({ description: "Include inactive verticals", default: false })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeInactive?: boolean;
}

export class VerticalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  cohortId: string;

  @ApiProperty()
  briefCap: number;

  @ApiProperty()
  briefCount: number;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  remainingCapacity: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BulkCreateVerticalsDto {
  @ApiProperty({ description: "Cohort ID" })
  @IsUUID()
  cohortId: string;

  @ApiProperty({
    description: "List of vertical names to create",
    type: [String],
    example: ["Healthcare", "Finance", "Agriculture", "Education"],
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  names: string[];

  @ApiPropertyOptional({ description: "Default brief cap for all verticals", default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  defaultBriefCap?: number;
}
