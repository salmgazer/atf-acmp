import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { DashboardService } from "./dashboard.service";
import {
  DashboardQueryDto,
  OverviewMetrics,
  TeamStatistics,
  SubmissionStatistics,
  EvaluationStatistics,
  PerformanceHeatmap,
} from "./dto/dashboard.dto";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("admin/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  @ApiOperation({ summary: "Get overview metrics for a cohort" })
  async getOverview(@Query() query: DashboardQueryDto): Promise<OverviewMetrics> {
    return this.dashboardService.getOverview(query);
  }

  @Get("teams")
  @ApiOperation({ summary: "Get team statistics with breakdowns" })
  async getTeamStatistics(@Query() query: DashboardQueryDto): Promise<TeamStatistics> {
    return this.dashboardService.getTeamStatistics(query);
  }

  @Get("submissions")
  @ApiOperation({ summary: "Get submission statistics by stage" })
  async getSubmissionStatistics(@Query() query: DashboardQueryDto): Promise<SubmissionStatistics> {
    return this.dashboardService.getSubmissionStatistics(query);
  }

  @Get("evaluations")
  @ApiOperation({ summary: "Get evaluation statistics and score distribution" })
  async getEvaluationStatistics(@Query() query: DashboardQueryDto): Promise<EvaluationStatistics> {
    return this.dashboardService.getEvaluationStatistics(query);
  }

  @Get("heatmap")
  @ApiOperation({ summary: "Get performance heatmap by vertical and country" })
  async getPerformanceHeatmap(@Query() query: DashboardQueryDto): Promise<PerformanceHeatmap> {
    return this.dashboardService.getPerformanceHeatmap(query);
  }
}
