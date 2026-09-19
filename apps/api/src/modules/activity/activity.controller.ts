import {
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { ActivityService } from "./activity.service";
import {
  ActivityStatsQueryDto,
  HourlyActivityTrendDto,
  WeeklyActivityTrendDto,
  ActivityStatsDto,
} from "./dto/activity.dto";

@Controller("admin/activity")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * Get hourly activity trend (last 24 hours)
   */
  @Get("hourly")
  async getHourlyTrend(
    @Query() query: ActivityStatsQueryDto
  ): Promise<HourlyActivityTrendDto> {
    return this.activityService.getHourlyTrend(query);
  }

  /**
   * Get weekly activity trend (last 7 days)
   */
  @Get("weekly")
  async getWeeklyTrend(
    @Query() query: ActivityStatsQueryDto
  ): Promise<WeeklyActivityTrendDto> {
    return this.activityService.getWeeklyTrend(query);
  }

  /**
   * Get combined activity statistics
   */
  @Get("stats")
  async getStats(
    @Query() query: ActivityStatsQueryDto
  ): Promise<ActivityStatsDto> {
    const [hourlyTrend, weeklyTrend, topEndpoints, activityByType, activityByPortal] =
      await Promise.all([
        this.activityService.getHourlyTrend(query),
        this.activityService.getWeeklyTrend(query),
        this.activityService.getTopEndpoints(query),
        this.activityService.getActivityByType(query),
        this.activityService.getActivityByPortal(query),
      ]);

    return {
      hourlyTrend,
      weeklyTrend,
      topEndpoints,
      activityByType,
      activityByPortal,
    };
  }

  /**
   * Get top endpoints
   */
  @Get("top-endpoints")
  async getTopEndpoints(
    @Query() query: ActivityStatsQueryDto
  ): Promise<Array<{ path: string; method: string; count: number }>> {
    return this.activityService.getTopEndpoints(query);
  }
}
