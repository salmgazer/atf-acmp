import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
  ParseUUIDPipe,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { LeaderboardService } from "./leaderboard.service";
import { LeaderboardQueryDto, UpdateLeaderboardConfigDto } from "./dto/leaderboard.dto";

/**
 * Public leaderboard controller
 */
@ApiTags("Leaderboard")
@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: "Get public leaderboard" })
  async getPublicLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getLeaderboard(query, false);
  }

  @Get("team/:teamId")
  @ApiOperation({ summary: "Get team rank" })
  async getTeamRank(
    @Query("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("teamId", ParseUUIDPipe) teamId: string,
  ) {
    const result = await this.leaderboardService.getTeamRank(cohortId, teamId);
    return result || { rank: null, totalTeams: 0 };
  }
}

/**
 * Admin leaderboard controller
 */
@ApiTags("Leaderboard")
@ApiBearerAuth()
@Controller("admin/leaderboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
export class AdminLeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: "Get full leaderboard (admin)" })
  async getAdminLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getLeaderboard(query, true);
  }

  @Get("export")
  @ApiOperation({ summary: "Export leaderboard to CSV" })
  async exportLeaderboard(@Query() query: LeaderboardQueryDto, @Res() res: Response) {
    const data = await this.leaderboardService.exportLeaderboard(query);

    if (data.length === 0) {
      res.status(200).send("No data to export");
      return;
    }

    // Generate CSV
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => {
          const value = row[h];
          // Escape quotes and wrap in quotes if contains comma or quote
          const strValue = String(value ?? "");
          if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        }).join(",")
      ),
    ];

    const csv = csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leaderboard-${query.cohortId}-${new Date().toISOString().split("T")[0]}.csv`
    );
    res.send(csv);
  }

  @Get("config/:cohortId")
  @ApiOperation({ summary: "Get leaderboard configuration" })
  async getConfig(@Param("cohortId", ParseUUIDPipe) cohortId: string) {
    return this.leaderboardService.getLeaderboardConfig(cohortId);
  }

  @Patch("config/:cohortId")
  @ApiOperation({ summary: "Update leaderboard configuration" })
  async updateConfig(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Body() config: UpdateLeaderboardConfigDto,
  ) {
    await this.leaderboardService.updateLeaderboardConfig(cohortId, config);
    return { success: true };
  }
}
