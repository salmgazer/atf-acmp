import { Controller, Get, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { SetupService } from "./setup.service";
import {
  SetupStatusDto,
  CreateInitialAdminDto,
  SetupCompleteDto,
} from "./dto/setup.dto";

@ApiTags("Setup")
@Controller("setup")
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get("status")
  @SkipThrottle()
  @ApiOperation({ summary: "Check if initial setup is complete" })
  @ApiResponse({
    status: 200,
    description: "Setup status",
    type: SetupStatusDto,
  })
  async getSetupStatus(): Promise<SetupStatusDto> {
    const isSetupComplete = await this.setupService.isSetupComplete();
    return { isSetupComplete };
  }

  @Post("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create initial super admin (only works if no admin exists)" })
  @ApiResponse({
    status: 201,
    description: "Initial admin created successfully",
    type: SetupCompleteDto,
  })
  @ApiResponse({
    status: 409,
    description: "Setup already complete or email already exists",
  })
  async createInitialAdmin(
    @Body() dto: CreateInitialAdminDto,
  ): Promise<SetupCompleteDto> {
    const user = await this.setupService.createInitialAdmin(dto);

    return {
      message: "Initial admin created successfully. You can now log in.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
