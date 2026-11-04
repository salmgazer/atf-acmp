import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";
import { MentorStatus } from "@/database/entities/mentor.entity";

export class ResendMentorInvitesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique()
  @IsUUID("4", { each: true })
  mentorIds: string[];
}

export class ResendImportedMentorInvitesDto {
  @IsUUID() cohortId: string;
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsEnum(MentorStatus) status?: MentorStatus;
  @IsOptional() @IsBoolean() @StrictBoolean() hasCapacity?: boolean;
  @IsOptional() @IsBoolean() @StrictBoolean() deleted?: boolean;
}

export interface MentorInviteProgress {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  failures: { mentorId: string; email: string; message: string }[];
}

export interface MentorInviteBatch extends MentorInviteProgress {
  id: string;
  state: "queued" | "active" | "completed" | "failed";
  error?: string;
}
