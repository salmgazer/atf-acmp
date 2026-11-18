import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { FileUrlDto } from "../submissions/dto/submission.dto";
import { FormAnswers } from "@acmp/shared";

export class SaveTeamBriefDto {
  @IsObject() answers: FormAnswers;
  @IsOptional() @IsBoolean() submit?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => FileUrlDto) fileUrls?: FileUrlDto[];
}
export class ReviewTeamBriefDto {
  @IsIn(["approved", "revision_requested", "rejected"]) action: "approved" | "revision_requested" | "rejected";
  @IsString() @MaxLength(5000) feedback: string;
  @IsOptional() @IsBoolean() contactVerified?: boolean;
}
