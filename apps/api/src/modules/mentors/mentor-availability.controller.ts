import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/database/entities/user.entity";
import { MentorAvailabilityService } from "./mentor-availability.service";
import {
  CreateAvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
  SetWeeklyAvailabilityDto,
  CreateAvailabilityExceptionDto,
  UpdateAvailabilityExceptionDto,
  CreateDateRangeExceptionDto,
  GetAvailableSlotsQueryDto,
} from "./dto/mentor-availability.dto";
import { MentorsService } from "./mentors.service";
import { Mentor } from "@/database/entities/mentor.entity";

/**
 * Controller for mentor availability management (mentor portal)
 * Mentors can manage their own weekly availability
 */
@ApiTags("Mentor Availability")
@ApiBearerAuth()
@Controller("mentor/availability")
@UseGuards(JwtAuthGuard)
export class MentorAvailabilityController {
  constructor(
    private readonly availabilityService: MentorAvailabilityService,
    private readonly mentorsService: MentorsService,
  ) {}

  private async getMentorFromUser(user: { email: string }): Promise<Mentor> {
    const mentor = await this.mentorsService.findByEmail(user.email);
    if (!mentor) {
      throw new NotFoundException("Mentor profile not found");
    }
    return mentor;
  }

  /**
   * Get the current mentor's weekly availability
   */
  @Get()
  @ApiOperation({ summary: "Get my weekly availability" })
  async getMyAvailability(@CurrentUser() user: { email: string }) {
    const mentor = await this.getMentorFromUser(user);
    return this.availabilityService.getWeeklyAvailability(mentor.id);
  }

  /**
   * Set/replace the mentor's entire weekly availability
   */
  @Put()
  @ApiOperation({ summary: "Set my weekly availability (replaces existing)" })
  async setMyAvailability(@CurrentUser() user: { email: string }, @Body() dto: SetWeeklyAvailabilityDto) {
    const mentor = await this.getMentorFromUser(user);
    return this.availabilityService.setWeeklyAvailability(mentor.id, dto);
  }

  /**
   * Add a single availability slot
   */
  @Post("slots")
  @ApiOperation({ summary: "Add a single availability slot" })
  async addSlot(@CurrentUser() user: { email: string }, @Body() dto: CreateAvailabilitySlotDto) {
    const mentor = await this.getMentorFromUser(user);
    return this.availabilityService.createAvailabilitySlot(mentor.id, dto);
  }

  /**
   * Update an availability slot
   */
  @Put("slots/:slotId")
  @ApiOperation({ summary: "Update an availability slot" })
  @ApiParam({ name: "slotId", description: "Slot ID" })
  async updateSlot(
    @Param("slotId", ParseUUIDPipe) slotId: string,
    @Body() dto: UpdateAvailabilitySlotDto,
  ) {
    return this.availabilityService.updateAvailabilitySlot(slotId, dto);
  }

  /**
   * Delete an availability slot
   */
  @Delete("slots/:slotId")
  @ApiOperation({ summary: "Delete an availability slot" })
  @ApiParam({ name: "slotId", description: "Slot ID" })
  async deleteSlot(@Param("slotId", ParseUUIDPipe) slotId: string) {
    await this.availabilityService.deleteAvailabilitySlot(slotId);
    return { success: true };
  }

  // ============ Exceptions ============

  /**
   * Get my exceptions (vacations, custom days)
   */
  @Get("exceptions")
  @ApiOperation({ summary: "Get my availability exceptions" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  async getMyExceptions(
    @CurrentUser() user: { email: string },
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const mentor = await this.getMentorFromUser(user);
    return this.availabilityService.getExceptions(mentor.id, startDate, endDate);
  }

  /**
   * Add an exception (vacation day, custom hours)
   */
  @Post("exceptions")
  @ApiOperation({ summary: "Add an availability exception" })
  async addException(@CurrentUser() user: { email: string }, @Body() dto: CreateAvailabilityExceptionDto) {
    const mentor = await this.getMentorFromUser(user);
    return this.availabilityService.createException(mentor.id, dto);
  }

  /**
   * Add exceptions for a date range (vacation period)
   */
  @Post("exceptions/range")
  @ApiOperation({ summary: "Mark a date range as unavailable (vacation)" })
  async addDateRangeException(@CurrentUser() user: { email: string }, @Body() dto: CreateDateRangeExceptionDto) {
    const mentor = await this.getMentorFromUser(user);
    return this.availabilityService.createDateRangeException(mentor.id, dto);
  }

  /**
   * Update an exception
   */
  @Put("exceptions/:exceptionId")
  @ApiOperation({ summary: "Update an availability exception" })
  @ApiParam({ name: "exceptionId", description: "Exception ID" })
  async updateException(
    @Param("exceptionId", ParseUUIDPipe) exceptionId: string,
    @Body() dto: UpdateAvailabilityExceptionDto,
  ) {
    return this.availabilityService.updateException(exceptionId, dto);
  }

  /**
   * Delete an exception
   */
  @Delete("exceptions/:exceptionId")
  @ApiOperation({ summary: "Delete an availability exception" })
  @ApiParam({ name: "exceptionId", description: "Exception ID" })
  async deleteException(@Param("exceptionId", ParseUUIDPipe) exceptionId: string) {
    await this.availabilityService.deleteException(exceptionId);
    return { success: true };
  }
}

/**
 * Controller for viewing mentor availability (public for participants)
 * Teams can view mentor's available slots for booking
 */
@ApiTags("Mentor Availability")
@ApiBearerAuth()
@Controller("mentors/:mentorId/availability")
@UseGuards(JwtAuthGuard)
export class MentorAvailabilityPublicController {
  constructor(private readonly availabilityService: MentorAvailabilityService) {}

  /**
   * Get a mentor's weekly availability schedule
   */
  @Get()
  @ApiOperation({ summary: "Get a mentor's weekly availability" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async getMentorAvailability(@Param("mentorId", ParseUUIDPipe) mentorId: string) {
    return this.availabilityService.getWeeklyAvailability(mentorId);
  }

  /**
   * Get available (bookable) slots for a mentor in a date range
   */
  @Get("slots")
  @ApiOperation({ summary: "Get available booking slots for a mentor" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async getAvailableSlots(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @Query() query: GetAvailableSlotsQueryDto,
  ) {
    return this.availabilityService.getAvailableSlots(mentorId, query);
  }
}

/**
 * Admin controller for managing mentor availability
 */
@ApiTags("Admin - Mentor Availability")
@ApiBearerAuth()
@Controller("admin/mentors/:mentorId/availability")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
export class AdminMentorAvailabilityController {
  constructor(private readonly availabilityService: MentorAvailabilityService) {}

  /**
   * Get a mentor's weekly availability
   */
  @Get()
  @ApiOperation({ summary: "Get a mentor's weekly availability" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async getMentorAvailability(@Param("mentorId", ParseUUIDPipe) mentorId: string) {
    return this.availabilityService.getWeeklyAvailability(mentorId);
  }

  /**
   * Set/replace a mentor's weekly availability
   */
  @Put()
  @ApiOperation({ summary: "Set a mentor's weekly availability" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async setMentorAvailability(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @Body() dto: SetWeeklyAvailabilityDto,
  ) {
    return this.availabilityService.setWeeklyAvailability(mentorId, dto);
  }

  /**
   * Add an availability slot for a mentor
   */
  @Post("slots")
  @ApiOperation({ summary: "Add an availability slot for a mentor" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async addSlot(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @Body() dto: CreateAvailabilitySlotDto,
  ) {
    return this.availabilityService.createAvailabilitySlot(mentorId, dto);
  }

  /**
   * Get exceptions for a mentor
   */
  @Get("exceptions")
  @ApiOperation({ summary: "Get a mentor's availability exceptions" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  async getExceptions(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.availabilityService.getExceptions(mentorId, startDate, endDate);
  }

  /**
   * Add an exception for a mentor
   */
  @Post("exceptions")
  @ApiOperation({ summary: "Add an availability exception for a mentor" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async addException(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @Body() dto: CreateAvailabilityExceptionDto,
  ) {
    return this.availabilityService.createException(mentorId, dto);
  }

  /**
   * Get available slots for a mentor
   */
  @Get("slots")
  @ApiOperation({ summary: "Get available booking slots for a mentor" })
  @ApiParam({ name: "mentorId", description: "Mentor ID" })
  async getAvailableSlots(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
    @Query() query: GetAvailableSlotsQueryDto,
  ) {
    return this.availabilityService.getAvailableSlots(mentorId, query);
  }
}
