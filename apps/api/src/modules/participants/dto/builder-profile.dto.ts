import { StrictBoolean } from "@/common/decorators/query-value.decorator";
import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { LANGUAGE_PROFICIENCIES, PROGRAMMING_LANGUAGES } from "@acmp/shared";
export class BuilderProfileDto {
  @IsIn(["", ...PROGRAMMING_LANGUAGES]) preferredLanguage: string;
  @IsOptional() @IsString() @MaxLength(80) @Transform(({ value }) => typeof value === "string" ? value.trim() : value) otherLanguage?: string;
  @IsIn(["", ...LANGUAGE_PROFICIENCIES]) languageProficiency: string;
  @IsBoolean() @StrictBoolean() developmentExperience: boolean;
  @IsBoolean() @StrictBoolean() testingExperience: boolean;
  @IsBoolean() @StrictBoolean() deploymentExperience: boolean;
}
export class ConfirmBuilderProfileDto extends BuilderProfileDto {
  @IsDateString() expectedUpdatedAt: string;
}
