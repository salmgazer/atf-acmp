import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { AuditAction } from "@/database/entities/audit-log.entity";

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  actorEmail?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateAuditLogDto {
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityName?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export class AuditLogResponseDto {
  id: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityName?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Record<string, { from: any; to: any }>;
  description?: string;
  ipAddress?: string;
  createdAt: Date;
}

export class AuditLogStatsDto {
  totalLogs: number;
  todayLogs: number;
  actionBreakdown: Record<string, number>;
  entityTypeBreakdown: Record<string, number>;
  topActors: { actorId: string; actorEmail: string; count: number }[];
}
