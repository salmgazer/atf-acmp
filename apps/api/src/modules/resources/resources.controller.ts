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
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { ResourcesService } from "./resources.service";
import {
  CreateResourceDto,
  UpdateResourceDto,
  ResourceQueryDto,
} from "./dto/resource.dto";

@ApiTags("resources")
@Controller("resources")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: "Get resources (filtered by user role)" })
  @ApiResponse({ status: 200, description: "Paginated resources" })
  async getResources(@Request() req: any, @Query() query: ResourceQueryDto) {
    const user = req.user;
    
    // If participant, use participant-specific filtering
    if (user.participantId && user.participant?.cohortId) {
      const result = await this.resourcesService.getResourcesForParticipant(
        user.participant.cohortId,
        user.participant.verticalId || null,
        query,
      );
      return {
        ...result,
        resources: result.resources.map((r) => ({
          ...r,
          accessUrl: r.getAccessUrl(),
        })),
      };
    }

    // For staff/admin or users without participant profile
    const result = await this.resourcesService.getResources(query, false);
    return {
      ...result,
      resources: result.resources.map((r) => ({
        ...r,
        accessUrl: r.getAccessUrl(),
      })),
    };
  }

  @Get("tags")
  @ApiOperation({ summary: "Get all resource tags" })
  @ApiQuery({ name: "cohortId", required: false, description: "Filter by cohort" })
  @ApiResponse({ status: 200, description: "List of tags" })
  async getTags(@Query("cohortId") cohortId?: string) {
    return this.resourcesService.getAllTags(cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a resource by ID" })
  @ApiParam({ name: "id", description: "Resource ID" })
  @ApiResponse({ status: 200, description: "Resource details" })
  @ApiResponse({ status: 404, description: "Resource not found" })
  async getResource(@Param("id", ParseUUIDPipe) id: string) {
    const resource = await this.resourcesService.getById(id);
    await this.resourcesService.incrementViewCount(id);
    return {
      ...resource,
      accessUrl: resource.getAccessUrl(),
    };
  }

  @Post(":id/download")
  @ApiOperation({ summary: "Track resource download" })
  @ApiParam({ name: "id", description: "Resource ID" })
  @ApiResponse({ status: 200, description: "Download tracked" })
  async trackDownload(@Param("id", ParseUUIDPipe) id: string) {
    await this.resourcesService.incrementDownloadCount(id);
    return { success: true };
  }
}

@ApiTags("resources-admin")
@Controller("admin/resources")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: "Get all resources (admin)" })
  @ApiResponse({ status: 200, description: "Paginated resources" })
  async getResources(@Query() query: ResourceQueryDto) {
    const result = await this.resourcesService.getResources(query, true);
    return {
      ...result,
      resources: result.resources.map((r) => ({
        ...r,
        accessUrl: r.getAccessUrl(),
      })),
    };
  }

  @Get("stats")
  @ApiOperation({ summary: "Get resource statistics" })
  @ApiQuery({ name: "cohortId", required: false, description: "Filter by cohort" })
  @ApiResponse({ status: 200, description: "Resource statistics" })
  async getStats(@Query("cohortId") cohortId?: string) {
    return this.resourcesService.getStats(cohortId);
  }

  @Post()
  @ApiOperation({ summary: "Create a new resource" })
  @ApiResponse({ status: 201, description: "Resource created" })
  async create(@Request() req: any, @Body() dto: CreateResourceDto) {
    const resource = await this.resourcesService.create(req.user.id, dto);
    return {
      ...resource,
      accessUrl: resource.getAccessUrl(),
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a resource by ID (admin)" })
  @ApiParam({ name: "id", description: "Resource ID" })
  @ApiResponse({ status: 200, description: "Resource details" })
  async getResource(@Param("id", ParseUUIDPipe) id: string) {
    const resource = await this.resourcesService.getById(id);
    return {
      ...resource,
      accessUrl: resource.getAccessUrl(),
    };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a resource" })
  @ApiParam({ name: "id", description: "Resource ID" })
  @ApiResponse({ status: 200, description: "Resource updated" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    const resource = await this.resourcesService.update(id, dto);
    return {
      ...resource,
      accessUrl: resource.getAccessUrl(),
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a resource" })
  @ApiParam({ name: "id", description: "Resource ID" })
  @ApiResponse({ status: 200, description: "Resource deleted" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    await this.resourcesService.delete(id);
    return { success: true };
  }
}
