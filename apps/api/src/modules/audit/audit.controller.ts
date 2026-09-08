import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { AuditService } from "./audit.service";
import { AuditLogQueryDto } from "./dto/audit.dto";

@ApiTags("Audit Logs")
@ApiBearerAuth()
@Controller("admin/audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Get all audit logs with filters" })
  @ApiQuery({ name: "actorId", required: false })
  @ApiQuery({ name: "actorEmail", required: false })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "entityType", required: false })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get("stats")
  @ApiOperation({ summary: "Get audit log statistics" })
  async getStats() {
    return this.auditService.getStats();
  }

  @Get("entity-types")
  @ApiOperation({ summary: "Get distinct entity types for filtering" })
  async getEntityTypes() {
    return this.auditService.getEntityTypes();
  }

  @Get("entity/:entityType/:entityId")
  @ApiOperation({ summary: "Get audit logs for a specific entity" })
  async findByEntity(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }

  @Get("actor/:actorId")
  @ApiOperation({ summary: "Get audit logs by actor" })
  async findByActor(@Param("actorId") actorId: string) {
    return this.auditService.findByActor(actorId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get audit log by ID" })
  async findOne(@Param("id") id: string) {
    const log = await this.auditService.findOne(id);
    if (!log) {
      throw new NotFoundException("Audit log not found");
    }
    return log;
  }
}
