import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThanOrEqual } from "typeorm";
import {
  ActivityLog,
  ActivityType,
  ActivityPortal,
} from "@/database/entities/activity-log.entity";
import {
  CreateActivityLogDto,
  ActivityStatsQueryDto,
  HourlyActivityTrendDto,
  WeeklyActivityTrendDto,
  HourlyActivityPoint,
  DailyActivityPoint,
} from "./dto/activity.dto";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>
  ) {}

  /**
   * Log an activity event
   */
  async log(dto: CreateActivityLogDto): Promise<ActivityLog | null> {
    try {
      const now = new Date();
      
      const activityLog = this.activityLogRepo.create({
        ...dto,
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
      });

      return await this.activityLogRepo.save(activityLog);
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`, error.stack);
      // Don't throw - activity logging should not break the main operation
      return null;
    }
  }

  /**
   * Batch log multiple activities (for efficiency)
   */
  async logBatch(activities: CreateActivityLogDto[]): Promise<void> {
    try {
      const now = new Date();
      const logs = activities.map((dto) =>
        this.activityLogRepo.create({
          ...dto,
          hourOfDay: now.getHours(),
          dayOfWeek: now.getDay(),
        })
      );
      await this.activityLogRepo.save(logs);
    } catch (error) {
      this.logger.error(`Failed to batch log activities: ${error.message}`, error.stack);
    }
  }

  /**
   * Get hourly activity trend for the last 24 hours
   */
  async getHourlyTrend(query: ActivityStatsQueryDto): Promise<HourlyActivityTrendDto> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const qb = this.activityLogRepo
      .createQueryBuilder("activity")
      .select("activity.hour_of_day", "hour")
      .addSelect("COUNT(*)", "count")
      .addSelect("COUNT(DISTINCT COALESCE(activity.user_id::text, activity.participant_id))", "uniqueUsers")
      .where("activity.created_at >= :startDate", { startDate: twentyFourHoursAgo });

    if (query.cohortId) {
      qb.andWhere("activity.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    if (query.portal) {
      qb.andWhere("activity.portal = :portal", { portal: query.portal });
    }

    qb.groupBy("activity.hour_of_day").orderBy("activity.hour_of_day", "ASC");

    const rawData = await qb.getRawMany();

    // Build a full 24-hour array
    const hourlyData: HourlyActivityPoint[] = [];
    let totalRequests = 0;
    let peakHour = 0;
    let peakHourCount = 0;

    for (let hour = 0; hour < 24; hour++) {
      const found = rawData.find((r) => parseInt(r.hour) === hour);
      const count = found ? parseInt(found.count) : 0;
      const uniqueUsers = found ? parseInt(found.uniqueUsers) : 0;

      hourlyData.push({ hour, count, uniqueUsers });
      totalRequests += count;

      if (count > peakHourCount) {
        peakHourCount = count;
        peakHour = hour;
      }
    }

    return {
      data: hourlyData,
      totalRequests,
      peakHour,
      peakHourCount,
    };
  }

  /**
   * Get weekly activity trend for the last 7 days
   */
  async getWeeklyTrend(query: ActivityStatsQueryDto): Promise<WeeklyActivityTrendDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const qb = this.activityLogRepo
      .createQueryBuilder("activity")
      .select("DATE(activity.created_at)", "date")
      .addSelect("EXTRACT(DOW FROM activity.created_at)", "dayOfWeek")
      .addSelect("COUNT(*)", "count")
      .addSelect("COUNT(DISTINCT COALESCE(activity.user_id::text, activity.participant_id))", "uniqueUsers")
      .where("activity.created_at >= :startDate", { startDate: sevenDaysAgo });

    if (query.cohortId) {
      qb.andWhere("activity.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    if (query.portal) {
      qb.andWhere("activity.portal = :portal", { portal: query.portal });
    }

    qb.groupBy("DATE(activity.created_at)")
      .addGroupBy("EXTRACT(DOW FROM activity.created_at)")
      .orderBy("date", "ASC");

    const rawData = await qb.getRawMany();

    // Build a full 7-day array
    const dailyData: DailyActivityPoint[] = [];
    let totalRequests = 0;
    let peakDay = "";
    let peakDayCount = 0;

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay();
      const dayName = DAY_NAMES[dayOfWeek];

      const found = rawData.find((r) => {
        const rDate = r.date instanceof Date ? r.date : new Date(r.date);
        return rDate.toISOString().split("T")[0] === dateStr;
      });
      const count = found ? parseInt(found.count) : 0;
      const uniqueUsers = found ? parseInt(found.uniqueUsers) : 0;

      dailyData.push({
        date: dateStr,
        dayOfWeek,
        dayName,
        count,
        uniqueUsers,
      });

      totalRequests += count;

      if (count > peakDayCount) {
        peakDayCount = count;
        peakDay = dayName;
      }
    }

    // Get total unique users over the week
    const uniqueUsersQuery = await this.activityLogRepo
      .createQueryBuilder("activity")
      .select("COUNT(DISTINCT COALESCE(activity.user_id::text, activity.participant_id))", "uniqueUsers")
      .where("activity.created_at >= :startDate", { startDate: sevenDaysAgo })
      .andWhere("(activity.user_id IS NOT NULL OR activity.participant_id IS NOT NULL)")
      .getRawOne();

    const totalUniqueUsers = uniqueUsersQuery ? parseInt(uniqueUsersQuery.uniqueUsers) : 0;

    return {
      data: dailyData,
      totalRequests,
      totalUniqueUsers,
      averageDaily: Math.round(totalRequests / 7),
      peakDay,
      peakDayCount,
    };
  }

  /**
   * Get top endpoints by request count
   */
  async getTopEndpoints(
    query: ActivityStatsQueryDto,
    limit = 10
  ): Promise<Array<{ path: string; method: string; count: number }>> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const qb = this.activityLogRepo
      .createQueryBuilder("activity")
      .select("activity.path", "path")
      .addSelect("activity.method", "method")
      .addSelect("COUNT(*)", "count")
      .where("activity.created_at >= :startDate", { startDate: sevenDaysAgo })
      .andWhere("activity.path IS NOT NULL");

    if (query.cohortId) {
      qb.andWhere("activity.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    if (query.portal) {
      qb.andWhere("activity.portal = :portal", { portal: query.portal });
    }

    qb.groupBy("activity.path")
      .addGroupBy("activity.method")
      .orderBy("count", "DESC")
      .limit(limit);

    const rawData = await qb.getRawMany();

    return rawData.map((r) => ({
      path: r.path,
      method: r.method || "GET",
      count: parseInt(r.count),
    }));
  }

  /**
   * Get activity breakdown by type
   */
  async getActivityByType(
    query: ActivityStatsQueryDto
  ): Promise<Record<string, number>> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const qb = this.activityLogRepo
      .createQueryBuilder("activity")
      .select("activity.activity_type", "activityType")
      .addSelect("COUNT(*)", "count")
      .where("activity.created_at >= :startDate", { startDate: sevenDaysAgo });

    if (query.cohortId) {
      qb.andWhere("activity.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    if (query.portal) {
      qb.andWhere("activity.portal = :portal", { portal: query.portal });
    }

    qb.groupBy("activity.activity_type");

    const rawData = await qb.getRawMany();

    const result: Record<string, number> = {};
    rawData.forEach((r) => {
      result[r.activityType] = parseInt(r.count);
    });

    return result;
  }

  /**
   * Get activity breakdown by portal
   */
  async getActivityByPortal(
    query: ActivityStatsQueryDto
  ): Promise<Record<string, number>> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const qb = this.activityLogRepo
      .createQueryBuilder("activity")
      .select("activity.portal", "portal")
      .addSelect("COUNT(*)", "count")
      .where("activity.created_at >= :startDate", { startDate: sevenDaysAgo });

    if (query.cohortId) {
      qb.andWhere("activity.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    qb.groupBy("activity.portal");

    const rawData = await qb.getRawMany();

    const result: Record<string, number> = {};
    rawData.forEach((r) => {
      result[r.portal] = parseInt(r.count);
    });

    return result;
  }

  /**
   * Clean up old activity logs (for maintenance)
   */
  async cleanupOldLogs(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.activityLogRepo.delete({
      createdAt: MoreThanOrEqual(cutoffDate),
    });

    return result.affected || 0;
  }

  /**
   * Helper methods for common activity logging
   */
  async logLogin(
    userId: string | undefined,
    participantId: string | undefined,
    cohortId: string | undefined,
    portal: ActivityPortal,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      userId,
      participantId,
      cohortId,
      activityType: ActivityType.LOGIN,
      portal,
      ...context,
    });
  }

  async logApiRequest(
    userId: string | undefined,
    participantId: string | undefined,
    cohortId: string | undefined,
    portal: ActivityPortal,
    path: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      userId,
      participantId,
      cohortId,
      activityType: ActivityType.API_REQUEST,
      portal,
      path,
      method,
      statusCode,
      responseTimeMs,
      ...context,
    });
  }

  async logPageView(
    userId: string | undefined,
    participantId: string | undefined,
    cohortId: string | undefined,
    portal: ActivityPortal,
    path: string,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      userId,
      participantId,
      cohortId,
      activityType: ActivityType.PAGE_VIEW,
      portal,
      path,
      ...context,
    });
  }
}
