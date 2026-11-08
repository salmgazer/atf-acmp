import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { SUBMISSION_UPDATE_FIELDS, SubmissionImportMode, SubmissionUpdateField } from "@acmp/shared";

export class SubmissionImportDto {
  @IsUUID() cohortId: string;
  @IsString() @MinLength(1) @MaxLength(500000) csv: string;
  @IsString() @MinLength(1) @MaxLength(255) sourceName: string;
  @IsString() @MinLength(1) @MaxLength(100) sourceTimezone: string;
  @IsOptional() @IsObject() primaryContacts?: Record<string, string>;
  @IsOptional() @IsIn(["create", "update_existing"]) mode?: SubmissionImportMode;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(SUBMISSION_UPDATE_FIELDS.length) @ArrayUnique()
  @IsIn(SUBMISSION_UPDATE_FIELDS.map(field => field.key), { each: true }) updateFields?: SubmissionUpdateField[];
}
export class ApplySubmissionImportDto extends SubmissionImportDto {
  @IsString() @MinLength(64) @MaxLength(64) previewHash: string;
}
