import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { MatchingService } from "./matching.service";
import { TeamFormationService } from "./team-formation.service";
import {
  RunMatchingDto,
  FinalizeMatchingDto,
  MatchingPreviewDto,
  BriefCapacityDto,
  TeamMatchStatusDto,
} from "./dto/matching.dto";
import {
  RunTeamFormationDto,
  FinalizeTeamFormationDto,
  TeamFormationPreviewDto,
  ParticipantFormationStatusDto,
} from "./dto/team-formation.dto";

@ApiTags("Matching")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@Controller("admin/cohorts/:cohortId/matching")
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly teamFormationService: TeamFormationService,
  ) {}

  // ============ Brief Matching Endpoints ============

  @Post("run")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Run matching algorithm",
    description:
      "Executes the team-brief matching algorithm and returns a preview of results",
  })
  @ApiResponse({ status: 200, type: MatchingPreviewDto })
  async runMatching(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Body() dto: RunMatchingDto,
  ): Promise<MatchingPreviewDto> {
    return this.matchingService.runMatching(cohortId, dto);
  }

  @Get("preview")
  @ApiOperation({
    summary: "Get matching preview",
    description: "Returns the current matching preview if one exists",
  })
  @ApiResponse({ status: 200, type: MatchingPreviewDto })
  async getPreview(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<MatchingPreviewDto | null> {
    return this.matchingService.getMatchingPreview(cohortId);
  }

  @Delete("preview")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Clear matching preview",
    description: "Clears the current matching preview cache",
  })
  async clearPreview(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<void> {
    this.matchingService.clearPreviewCache(cohortId);
  }

  @Post("finalize")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Finalize matching",
    description:
      "Applies the matching preview assignments to teams. Supports manual overrides and exclusions.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: {
        assignedCount: { type: "number" },
        errors: { type: "array", items: { type: "string" } },
      },
    },
  })
  async finalizeMatching(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Body() dto: FinalizeMatchingDto,
  ): Promise<{ assignedCount: number; errors: string[] }> {
    return this.matchingService.finalizeMatching(cohortId, dto);
  }

  @Get("brief-capacities")
  @ApiOperation({
    summary: "Get brief capacities",
    description:
      "Returns capacity information for all approved briefs in the cohort",
  })
  @ApiResponse({ status: 200, type: [BriefCapacityDto] })
  async getBriefCapacities(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<BriefCapacityDto[]> {
    return this.matchingService.getBriefCapacities(cohortId);
  }

  @Get("team-status")
  @ApiOperation({
    summary: "Get team matching status",
    description:
      "Returns matching status for all eligible teams in the cohort",
  })
  @ApiResponse({ status: 200, type: [TeamMatchStatusDto] })
  async getTeamStatus(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<TeamMatchStatusDto[]> {
    return this.matchingService.getTeamMatchStatus(cohortId);
  }

  // ============ Team Formation Endpoints ============

  @Post("formation/run")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Run team formation algorithm",
    description:
      "Forms teams from participants without teams, considering preferences, skills, interests, and country",
  })
  @ApiResponse({ status: 200, type: TeamFormationPreviewDto })
  async runTeamFormation(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Body() dto: RunTeamFormationDto,
  ): Promise<TeamFormationPreviewDto> {
    return this.teamFormationService.runTeamFormation(cohortId, dto);
  }

  @Get("formation/preview")
  @ApiOperation({
    summary: "Get team formation preview",
    description: "Returns the current team formation preview if one exists",
  })
  @ApiResponse({ status: 200, type: TeamFormationPreviewDto })
  async getFormationPreview(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<TeamFormationPreviewDto | null> {
    return this.teamFormationService.getTeamFormationPreview(cohortId);
  }

  @Delete("formation/preview")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Clear team formation preview",
    description: "Clears the current team formation preview cache",
  })
  async clearFormationPreview(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<void> {
    this.teamFormationService.clearFormationPreviewCache(cohortId);
  }

  @Post("formation/finalize")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Finalize team formation",
    description:
      "Creates actual teams from the formation preview. Supports manual overrides and exclusions.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: {
        createdTeamCount: { type: "number" },
        errors: { type: "array", items: { type: "string" } },
      },
    },
  })
  async finalizeTeamFormation(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Body() dto: FinalizeTeamFormationDto,
  ): Promise<{ createdTeamCount: number; errors: string[] }> {
    return this.teamFormationService.finalizeTeamFormation(cohortId, dto);
  }

  @Get("formation/participant-status")
  @ApiOperation({
    summary: "Get participant formation status",
    description:
      "Returns the team formation status for all participants in the cohort",
  })
  @ApiResponse({ status: 200, type: [ParticipantFormationStatusDto] })
  async getParticipantFormationStatus(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
  ): Promise<ParticipantFormationStatusDto[]> {
    return this.teamFormationService.getParticipantFormationStatus(cohortId);
  }
}
