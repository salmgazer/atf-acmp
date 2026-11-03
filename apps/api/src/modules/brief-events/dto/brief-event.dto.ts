import { IsDateString, IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreateBriefEventDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  title: string;

  @ApiProperty({ description: "What the organization wants to discuss" })
  @IsString() @MinLength(1) @MaxLength(1900)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  description: string;

  @ApiProperty({ description: "ISO 8601 timestamp with timezone offset" })
  @IsDateString({ strict: true }) startAt: string;

  @ApiProperty({ example: "Africa/Accra" }) @IsString() @MaxLength(100) timezone: string;
  @ApiProperty({ example: 60 }) @IsInt() @Min(15) @Max(480) durationMinutes: number;
}

export class UpdateBriefEventDto extends PartialType(CreateBriefEventDto, { skipNullProperties: false }) {}
