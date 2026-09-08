import { 
  Controller, 
  Get, 
  Post,
  Patch,
  Delete,
  Param, 
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { 
  CreateStaffDto, 
  UpdateStaffDto, 
  StaffQueryDto, 
  StaffResponseDto,
} from "./dto/staff.dto";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  async findOne(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}

// Separate controller for admin staff management
@ApiTags("admin/staff")
@Controller("admin/staff")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get all staff members" })
  @ApiResponse({ status: 200, description: "List of staff members", type: [StaffResponseDto] })
  async findAll(@Query() query: StaffQueryDto): Promise<StaffResponseDto[]> {
    return this.usersService.findAllStaff(query);
  }

  @Get("statistics")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
  @ApiOperation({ summary: "Get staff statistics" })
  @ApiResponse({ status: 200, description: "Staff statistics" })
  async getStatistics() {
    return this.usersService.getStaffStatistics();
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER)
  @ApiOperation({ summary: "Get a staff member by ID" })
  @ApiParam({ name: "id", description: "Staff member ID" })
  @ApiResponse({ status: 200, description: "Staff member details", type: StaffResponseDto })
  @ApiResponse({ status: 404, description: "Staff member not found" })
  async findOne(@Param("id") id: string): Promise<StaffResponseDto> {
    return this.usersService.findStaffById(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a new staff member (Super Admin only)" })
  @ApiResponse({ status: 201, description: "Staff member created", type: StaffResponseDto })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  async create(@Body() dto: CreateStaffDto): Promise<StaffResponseDto> {
    return this.usersService.createStaff(dto);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update a staff member (Super Admin only)" })
  @ApiParam({ name: "id", description: "Staff member ID" })
  @ApiResponse({ status: 200, description: "Staff member updated", type: StaffResponseDto })
  @ApiResponse({ status: 404, description: "Staff member not found" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateStaffDto
  ): Promise<StaffResponseDto> {
    return this.usersService.updateStaff(id, dto);
  }

  @Post(":id/deactivate")
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Deactivate a staff member (revoke access)" })
  @ApiParam({ name: "id", description: "Staff member ID" })
  @ApiResponse({ status: 200, description: "Staff member deactivated", type: StaffResponseDto })
  async deactivate(@Param("id") id: string): Promise<StaffResponseDto> {
    return this.usersService.deactivateStaff(id);
  }

  @Post(":id/activate")
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reactivate a staff member" })
  @ApiParam({ name: "id", description: "Staff member ID" })
  @ApiResponse({ status: 200, description: "Staff member activated", type: StaffResponseDto })
  async activate(@Param("id") id: string): Promise<StaffResponseDto> {
    return this.usersService.activateStaff(id);
  }

  @Post(":id/resend-invite")
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend invitation email with new temporary password" })
  @ApiParam({ name: "id", description: "Staff member ID" })
  @ApiResponse({ status: 200, description: "Invitation email sent" })
  @ApiResponse({ status: 404, description: "Staff member not found" })
  async resendInvite(@Param("id") id: string): Promise<{ message: string }> {
    await this.usersService.resendStaffInvite(id);
    return { message: "Invitation email sent successfully" };
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a staff member (Super Admin only)" })
  @ApiParam({ name: "id", description: "Staff member ID" })
  @ApiResponse({ status: 204, description: "Staff member deleted" })
  @ApiResponse({ status: 400, description: "Cannot delete the only super admin" })
  async delete(@Param("id") id: string): Promise<void> {
    return this.usersService.deleteStaff(id);
  }
}
