import { Type, Transform } from "class-transformer";
import { IsDefined, IsIn, IsInt, IsNotEmpty, IsObject, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { OmitType } from "@nestjs/swagger";
import { ParticipantQueryDto } from "./participant.dto";

export class BuilderFiltersDto extends OmitType(ParticipantQueryDto, ["page", "limit", "status", "onboardingComplete"] as const) {
  @IsIn(["all", "confirmed", "pending"]) confirmation: "all" | "confirmed" | "pending" = "all";
  @IsIn(["all", "assigned", "unassigned"]) assignment: "all" | "assigned" | "unassigned" = "all";
}

export class BuilderQueryDto extends BuilderFiltersDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(500) limit = 25;
}

export class BuilderBroadcastDto {
  @IsUUID() requestId: string;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => BuilderFiltersDto) filters: BuilderFiltersDto;
  @IsString() @Matches(/^[a-f0-9]{64}$/) audienceHash: string;
  @IsString() @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsNotEmpty() @MaxLength(200) @Matches(/^[^\r\n]+$/) subject: string;
  @IsString() @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsNotEmpty() @MaxLength(20000) message: string;
}

export interface BuilderRow {
  id: string; participantId: string; firstName: string; lastName: string; email: string;
  country: string; group: string | null; cohortId: string; cohortName: string;
  preferredLanguage: string | null; otherLanguage: string | null; languageProficiency: string | null;
  developmentExperience: boolean | null; testingExperience: boolean | null; deploymentExperience: boolean | null;
  builderConfirm: boolean; preferredRole: string | null; teamId: string | null; teamName: string | null;
}
