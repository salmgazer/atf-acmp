import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS, type BuildDeployAbility, type MatchingRole, type MatchingSector, type MatchingTeamStatus } from "@acmp/shared";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";

export const PARTICIPANT_MATCHING_EDIT_FIELDS = ["buildDeployAbility", "preferredRole", "firstChoiceSector", "backupSector", "teamStatus", "crossCountryWilling", "matchingProfileConsent", "verticalId1", "verticalId2", "availabilityNotes", "briefRankings"] as const;

export class UpdateParticipantMatchingProfileDto {
  @IsDateString() expectedUpdatedAt: string;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(BUILD_DEPLOY_OPTIONS.map(option => option.value)) buildDeployAbility?: BuildDeployAbility;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(MATCHING_ROLE_OPTIONS.map(option => option.value)) preferredRole?: MatchingRole;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(MATCHING_SECTOR_OPTIONS.map(option => option.value)) firstChoiceSector?: MatchingSector;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(MATCHING_SECTOR_OPTIONS.map(option => option.value)) backupSector?: MatchingSector;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(MATCHING_TEAM_STATUS_OPTIONS.map(option => option.value)) teamStatus?: MatchingTeamStatus;
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() @StrictBoolean() crossCountryWilling?: boolean;
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() @StrictBoolean() matchingProfileConsent?: boolean;
  @IsOptional() @IsUUID() verticalId1?: string | null;
  @IsOptional() @IsUUID() verticalId2?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(({ value }) => typeof value === "string" ? value.trim() : value) availabilityNotes?: string | null;
  @ValidateIf((_o, value) => value !== undefined) @IsArray() @IsUUID("4", { each: true }) @ArrayUnique() @ArrayMaxSize(5) briefRankings?: string[];
}
