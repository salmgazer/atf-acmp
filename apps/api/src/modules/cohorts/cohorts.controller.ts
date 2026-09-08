import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { CohortsService } from "./cohorts.service";
import {
  CreateCohortDto,
  UpdateCohortDto,
  UpdateCohortStatusDto,
  CohortQueryDto,
  CohortResponseDto,
  PaginatedCohortsResponseDto,
} from "./dto/cohort.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../database/entities/user.entity";
import { Audit } from "../../common/decorators/audit.decorator";
import { AuditInterceptor } from "../../common/interceptors/audit.interceptor";
import { AuditAction } from "../../database/entities/audit-log.entity";

@ApiTags("cohorts")
@Controller("cohorts")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@ApiBearerAuth()
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Cohort",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Created cohort: ${result?.name}`,
  })
  @ApiOperation({ summary: "Create a new cohort" })
  @ApiResponse({ status: 201, description: "Cohort created", type: CohortResponseDto })
  @ApiResponse({ status: 400, description: "Validation error" })
  async create(@Body() createCohortDto: CreateCohortDto): Promise<CohortResponseDto> {
    return this.cohortsService.create(createCohortDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get all cohorts (paginated)" })
  @ApiResponse({ status: 200, description: "List of cohorts", type: PaginatedCohortsResponseDto })
  async findAll(@Query() query: CohortQueryDto): Promise<PaginatedCohortsResponseDto> {
    return this.cohortsService.findAll(query);
  }

  @Get("active")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get the currently active cohort" })
  @ApiResponse({ status: 200, description: "Active cohort", type: CohortResponseDto })
  @ApiResponse({ status: 404, description: "No active cohort" })
  async findActive(): Promise<CohortResponseDto | null> {
    return this.cohortsService.findActive();
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get a cohort by ID" })
  @ApiParam({ name: "id", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Cohort details", type: CohortResponseDto })
  @ApiResponse({ status: 404, description: "Cohort not found" })
  async findOne(@Param("id") id: string): Promise<CohortResponseDto> {
    return this.cohortsService.findOne(id);
  }

  @Get(":id/statistics")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get cohort statistics" })
  @ApiParam({ name: "id", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Cohort statistics" })
  async getStatistics(@Param("id") id: string) {
    return this.cohortsService.getStatistics(id);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Cohort",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Updated cohort: ${result?.name}`,
  })
  @ApiOperation({ summary: "Update a cohort" })
  @ApiParam({ name: "id", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Cohort updated", type: CohortResponseDto })
  @ApiResponse({ status: 404, description: "Cohort not found" })
  async update(
    @Param("id") id: string,
    @Body() updateCohortDto: UpdateCohortDto
  ): Promise<CohortResponseDto> {
    return this.cohortsService.update(id, updateCohortDto);
  }

  @Patch(":id/status")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Cohort",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result, args) => `Changed cohort status to ${args[1]?.status}: ${result?.name}`,
  })
  @ApiOperation({ summary: "Update cohort status" })
  @ApiParam({ name: "id", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Status updated", type: CohortResponseDto })
  @ApiResponse({ status: 400, description: "Invalid status transition" })
  @ApiResponse({ status: 409, description: "Another cohort is active" })
  async updateStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateCohortStatusDto
  ): Promise<CohortResponseDto> {
    return this.cohortsService.updateStatus(id, updateStatusDto.status);
  }

  @Post(":id/duplicate")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Cohort",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result, args) => `Duplicated cohort from ${args[0]?.id}: ${result?.name}`,
  })
  @ApiOperation({ summary: "Duplicate a cohort" })
  @ApiParam({ name: "id", description: "Source cohort ID" })
  @ApiResponse({ status: 201, description: "Cohort duplicated", type: CohortResponseDto })
  async duplicate(
    @Param("id") id: string,
    @Body("name") name: string
  ): Promise<CohortResponseDto> {
    return this.cohortsService.duplicate(id, name);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  @Audit({
    action: AuditAction.DELETE,
    entityType: "Cohort",
    getEntityId: (_, args) => args[0]?.id,
    getDescription: (_, args) => `Deleted cohort: ${args[0]?.id}`,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a cohort (DRAFT only)" })
  @ApiParam({ name: "id", description: "Cohort ID" })
  @ApiResponse({ status: 204, description: "Cohort deleted" })
  @ApiResponse({ status: 400, description: "Cannot delete non-DRAFT cohort" })
  async remove(@Param("id") id: string): Promise<void> {
    return this.cohortsService.remove(id);
  }

  @Post(":id/init-forum")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Initialize default forum categories for a cohort (if none exist)" })
  @ApiParam({ name: "id", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Forum categories initialized" })
  @ApiResponse({ status: 400, description: "Forum categories already exist" })
  async initializeForum(@Param("id") id: string): Promise<{ message: string; categoriesCreated: number }> {
    return this.cohortsService.initializeForumCategories(id);
  }
}
