import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ParticipantStatus } from "@/database/entities/participant.entity";

export class ResendParticipantInvitesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique()
  @IsUUID("4", { each: true })
  participantIds: string[];
}

export class ResendPendingParticipantInvitesDto {
  @IsUUID() cohortId: string;
  @IsOptional() @IsString() @MaxLength(100) group?: string;
  @IsOptional() @IsBoolean() ungrouped?: boolean;
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsEnum(ParticipantStatus) status?: ParticipantStatus;
}

export interface ParticipantInviteProgress {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Bounded to avoid storing an unbounded response in Redis. */
  failures: { participantId: string; message: string }[];
}

export interface ParticipantInviteBatch extends ParticipantInviteProgress {
  id: string;
  state: "queued" | "active" | "completed" | "failed";
  error?: string;
}
