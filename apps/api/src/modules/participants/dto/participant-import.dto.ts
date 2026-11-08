import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { PARTICIPANT_IMPORT_FIELDS, ParticipantImportField } from "@acmp/shared";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";

export class ParticipantImportDto {
  @IsUUID() cohortId: string;
  @IsString() @MinLength(1) @MaxLength(2000000) csv: string;
  @IsString() @MinLength(1) @MaxLength(255) sourceName: string;
  @IsOptional() @IsIn(["create_and_update", "create_only", "update_only"]) mode?: "create_and_update" | "create_only" | "update_only";
  @IsOptional() @IsString() @MaxLength(100) group?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(22) @ArrayUnique() @IsIn(PARTICIPANT_IMPORT_FIELDS, { each: true }) updateFields?: ParticipantImportField[];
  @IsOptional() @IsBoolean() @StrictBoolean() allowLearningCorrections?: boolean;
  @IsOptional() @IsBoolean() @StrictBoolean() sendWelcomeEmail?: boolean;
}
export class ApplyParticipantImportDto extends ParticipantImportDto {
  @IsString() @MinLength(64) @MaxLength(64) previewHash: string;
}
