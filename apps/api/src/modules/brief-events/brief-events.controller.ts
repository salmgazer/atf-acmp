import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";
import { BriefEventsService, EventActor } from "./brief-events.service";
import { CreateBriefEventDto, UpdateBriefEventDto } from "./dto/brief-event.dto";
import { BriefEventCalendarQueryDto } from "./dto/brief-event-calendar.dto";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";

@ApiTags("brief-events")
@ApiBearerAuth()
@Controller("brief-events")
@UseInterceptors(AuditInterceptor)
export class BriefEventsController {
  constructor(private readonly events: BriefEventsService) {}

  @Get("calendar")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  staffCalendar(@Query() query: BriefEventCalendarQueryDto, @CurrentUser() actor: EventActor) { return this.events.staffCalendar(query, actor); }

  @Get("brief/:briefId")
  list(@Param("briefId", ParseUUIDPipe) id: string, @CurrentUser() actor: EventActor) { return this.events.list(id, actor); }

  @Post("brief/:briefId")
  @Audit({ action: AuditAction.CREATE, entityType: "BriefEvent", getEntityId: result => result?.id, getDescription: () => "Scheduled brief event" })
  create(@Param("briefId", ParseUUIDPipe) id: string, @Body() dto: CreateBriefEventDto, @CurrentUser() actor: EventActor) { return this.events.create(id, dto, actor); }

  @Patch(":id")
  @Audit({ action: AuditAction.UPDATE, entityType: "BriefEvent", getEntityId: result => result?.id, getDescription: () => "Updated brief event" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateBriefEventDto, @CurrentUser() actor: EventActor) { return this.events.update(id, dto, actor); }

  @Post(":id/cancel")
  @Audit({ action: AuditAction.UPDATE, entityType: "BriefEvent", getEntityId: result => result?.id, getDescription: () => "Cancelled brief event" })
  cancel(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() actor: EventActor) { return this.events.cancel(id, actor); }

  @Get(":id/calendar")
  async calendar(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() actor: EventActor, @Res() response: Response) {
    const content = await this.events.download(id, actor);
    response.setHeader("Content-Type", "text/calendar; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="brief-event.ics"');
    response.setHeader("Cache-Control", "private, no-store");
    response.send(content);
  }

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() actor: EventActor, @Res({ passthrough: true }) response: Response) {
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Pragma", "no-cache");
    return this.events.start(id, actor);
  }
}
