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
import { VerticalsService } from "./verticals.service";
import {
  CreateVerticalDto,
  UpdateVerticalDto,
  VerticalQueryDto,
  VerticalResponseDto,
  BulkCreateVerticalsDto,
} from "./dto/vertical.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../database/entities/user.entity";

@ApiTags("verticals")
@Controller("verticals")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VerticalsController {
  constructor(private readonly verticalsService: VerticalsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Create a new vertical" })
  @ApiResponse({ status: 201, description: "Vertical created", type: VerticalResponseDto })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 409, description: "Vertical name already exists in cohort" })
  async create(@Body() createVerticalDto: CreateVerticalDto): Promise<VerticalResponseDto> {
    return this.verticalsService.create(createVerticalDto);
  }

  @Post("bulk")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Create multiple verticals at once" })
  @ApiResponse({ status: 201, description: "Verticals created", type: [VerticalResponseDto] })
  async bulkCreate(@Body() dto: BulkCreateVerticalsDto): Promise<VerticalResponseDto[]> {
    return this.verticalsService.bulkCreate(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get all verticals (optionally filter by cohort)" })
  @ApiResponse({ status: 200, description: "List of verticals", type: [VerticalResponseDto] })
  async findAll(@Query() query: VerticalQueryDto): Promise<VerticalResponseDto[]> {
    return this.verticalsService.findAll(query);
  }

  @Get("cohort/:cohortId")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get all verticals for a cohort" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "List of verticals", type: [VerticalResponseDto] })
  async findByCohort(@Param("cohortId") cohortId: string): Promise<VerticalResponseDto[]> {
    return this.verticalsService.findByCohort(cohortId);
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get a vertical by ID" })
  @ApiParam({ name: "id", description: "Vertical ID" })
  @ApiResponse({ status: 200, description: "Vertical details", type: VerticalResponseDto })
  @ApiResponse({ status: 404, description: "Vertical not found" })
  async findOne(@Param("id") id: string): Promise<VerticalResponseDto> {
    return this.verticalsService.findOne(id);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Update a vertical" })
  @ApiParam({ name: "id", description: "Vertical ID" })
  @ApiResponse({ status: 200, description: "Vertical updated", type: VerticalResponseDto })
  @ApiResponse({ status: 404, description: "Vertical not found" })
  async update(
    @Param("id") id: string,
    @Body() updateVerticalDto: UpdateVerticalDto
  ): Promise<VerticalResponseDto> {
    return this.verticalsService.update(id, updateVerticalDto);
  }

  @Patch(":id/deactivate")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Deactivate a vertical (soft disable)" })
  @ApiParam({ name: "id", description: "Vertical ID" })
  @ApiResponse({ status: 200, description: "Vertical deactivated", type: VerticalResponseDto })
  async deactivate(@Param("id") id: string): Promise<VerticalResponseDto> {
    return this.verticalsService.deactivate(id);
  }

  @Post("reorder")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Reorder verticals within a cohort" })
  @ApiResponse({ status: 200, description: "Verticals reordered", type: [VerticalResponseDto] })
  async reorder(
    @Body("cohortId") cohortId: string,
    @Body("verticalIds") verticalIds: string[]
  ): Promise<VerticalResponseDto[]> {
    return this.verticalsService.reorder(cohortId, verticalIds);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a vertical (only if no briefs assigned)" })
  @ApiParam({ name: "id", description: "Vertical ID" })
  @ApiResponse({ status: 204, description: "Vertical deleted" })
  @ApiResponse({ status: 400, description: "Cannot delete vertical with assigned briefs" })
  async remove(@Param("id") id: string): Promise<void> {
    return this.verticalsService.remove(id);
  }
}
