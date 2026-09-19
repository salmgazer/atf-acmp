import { IsOptional, IsString, IsEnum, IsUUID, IsDateString } from "class-validator";
import { ActivityType, ActivityPortal } from "@/database/entities/activity-log.entity";

/**
 * DTO for creating an activity log
 */
export class CreateActivityLogDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  participantId?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsEnum(ActivityType)
  activityType: ActivityType;

  @IsOptional()
  @IsEnum(ActivityPortal)
  portal?: ActivityPortal;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  statusCode?: number;

  @IsOptional()
  responseTimeMs?: number;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * Query params for fetching activity statistics
 */
export class ActivityStatsQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsEnum(ActivityPortal)
  portal?: ActivityPortal;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * Hourly activity data point
 */
export interface HourlyActivityPoint {
  hour: number; // 0-23
  count: number;
  uniqueUsers: number;
}

/**
 * Daily activity data point
 */
export interface DailyActivityPoint {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayName: string; // Sunday, Monday, etc.
  count: number;
  uniqueUsers: number;
}

/**
 * Activity trend response for hourly chart
 */
export interface HourlyActivityTrendDto {
  data: HourlyActivityPoint[];
  totalRequests: number;
  peakHour: number;
  peakHourCount: number;
}

/**
 * Activity trend response for weekly chart
 */
export interface WeeklyActivityTrendDto {
  data: DailyActivityPoint[];
  totalRequests: number;
  totalUniqueUsers: number;
  averageDaily: number;
  peakDay: string;
  peakDayCount: number;
}

/**
 * Combined activity statistics
 */
export interface ActivityStatsDto {
  hourlyTrend: HourlyActivityTrendDto;
  weeklyTrend: WeeklyActivityTrendDto;
  topEndpoints: Array<{ path: string; method: string; count: number }>;
  activityByType: Record<string, number>;
  activityByPortal: Record<string, number>;
}
