import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";
import { GITHUB_USERNAME_PATTERN, PARTICIPANT_LEARNING_FIELDS, PARTICIPANT_PROFILE_IMPORT_FIELDS } from "@acmp/shared";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";

export const STAFF_PARTICIPANT_PROFILE_FIELDS = [...PARTICIPANT_PROFILE_IMPORT_FIELDS, "country", "lmsEmail", "skills", "interests", ...PARTICIPANT_LEARNING_FIELDS] as const;
const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

/** Separate from participant self-service: only staff may correct imported learning records. */
export class StaffParticipantProfileDto {
  @IsDateString() expectedUpdatedAt: string;
  @IsOptional() @IsBoolean() @StrictBoolean() allowLearningCorrections?: boolean;

  @ValidateIf((_object, value) => value !== undefined) @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) firstName?: string;
  @ValidateIf((_object, value) => value !== undefined) @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) lastName?: string;
  @ValidateIf((_object, value) => value !== undefined) @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) country?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) institution?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) phoneNumber?: string | null;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(255) lmsEmail?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) whatsappNumber?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) city?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) locationType?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) gender?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) educationLevel?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) currentAffiliation?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) fieldOfStudy?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) pythonSkill?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) gitSkill?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) aiExperience?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(39) @Matches(GITHUB_USERNAME_PATTERN) githubUsername?: string | null;
  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(100, { each: true }) skills?: string[];
  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(100, { each: true }) interests?: string[];
  @IsOptional() @IsBoolean() @StrictBoolean() learningCertificateIssued?: boolean | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) learningCertificateId?: string | null;
  @IsOptional() @Transform(trim) @Matches(/^\d{4}-\d{2}-\d{2}$/) learningCertificateDate?: string | null;
  @IsOptional() @IsBoolean() @StrictBoolean() learningFinishedAllLessons?: boolean | null;
  @IsOptional() @IsBoolean() @StrictBoolean() learningHalfwayReached?: boolean | null;
}
