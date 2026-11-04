import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class BriefEventCalendarQueryDto {
  @IsUUID() cohortId: string;
  @IsDateString({ strict: true }) startAt: string;
  @IsDateString({ strict: true }) endAt: string;
  @IsOptional() @IsString() @MaxLength(255) search?: string;
}
