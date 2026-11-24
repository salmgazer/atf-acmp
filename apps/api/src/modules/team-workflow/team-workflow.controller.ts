import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards, UseInterceptors } from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { Role } from "@/database/entities/user.entity";
import { TeamWorkflowService } from "./team-workflow.service";
import { ReviewTeamBriefDto, SaveTeamBriefDto } from "./team-workflow.dto";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@Controller("team-workflow")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARTICIPANT)
export class TeamWorkflowController {
  constructor(private readonly workflow: TeamWorkflowService) {}
  @Get() async progress(@Request() req: any, @Query("version") version?: string) {
    const progress = await this.workflow.progressForParticipant(req.user.id);
    // Keep already-loaded clients usable while API and web roll out in sequence.
    return version === "2" ? progress : { ...progress, steps: progress.steps.filter(step => step.key !== "warmup").map((step, index) => ({ ...step, number: index + 1 })) };
  }
  @Get("brief") brief(@Request() req: any) { return this.workflow.ownBrief(req.user.id); }
  @Post("brief") save(@Request() req: any, @Body() dto: SaveTeamBriefDto) { return this.workflow.saveOwnBrief(req.user.id, dto); }
}
@Controller("admin/team-workflow")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
export class AdminTeamWorkflowController {
  constructor(private readonly workflow: TeamWorkflowService) {}
  @Get("inactive/:id") inactive(@Param("id", ParseUUIDPipe) id: string) { return this.workflow.inactiveTeams(id); }
  @Post("teams/:id/resources-issued") @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @Audit({ action: AuditAction.STATUS_CHANGE, entityType: "Team", getDescription: () => "Recorded programme resources issued" })
  resources(@Param("id", ParseUUIDPipe) id: string, @Request() req: any) { return this.workflow.recordResourcesIssued(id, req.user.id); }
  @Get("teams/:id") progress(@Param("id", ParseUUIDPipe) id: string) { return this.workflow.progress(id); }
  @Get("briefs/:id") brief(@Param("id", ParseUUIDPipe) id: string) { return this.workflow.briefDetails(id); }
  @Post("briefs/:id/review") @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR)
  @Audit({ action: AuditAction.STATUS_CHANGE, entityType: "Brief", getEntityId: result => result?.id, getDescription: result => `Team brief review: ${result?.status}` })
  review(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReviewTeamBriefDto, @Request() req: any) { return this.workflow.reviewBrief(id, dto, req.user.id); }
}
