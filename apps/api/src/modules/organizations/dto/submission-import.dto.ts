import { IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SubmissionImportDto {
  @IsUUID() cohortId: string;
  @IsString() @MinLength(1) @MaxLength(500000) csv: string;
  @IsString() @MinLength(1) @MaxLength(255) sourceName: string;
  @IsString() @MinLength(1) @MaxLength(100) sourceTimezone: string;
  @IsOptional() @IsObject() primaryContacts?: Record<string, string>;
}
export class ApplySubmissionImportDto extends SubmissionImportDto {
  @IsString() @MinLength(64) @MaxLength(64) previewHash: string;
}
