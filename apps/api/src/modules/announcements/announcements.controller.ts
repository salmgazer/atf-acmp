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
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/database/entities/user.entity";
import { AnnouncementsService } from "./announcements.service";
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementQueryDto,
  ParticipantAnnouncementQueryDto,
} from "./dto/announcement.dto";

/**
 * Admin announcement controller
 */
@ApiTags("Announcements")
@ApiBearerAuth()
@Controller("admin/announcements")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
export class AdminAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new announcement" })
  async create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: any) {
    return this.announcementsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "List all announcements" })
  async findAll(@Query() query: AnnouncementQueryDto) {
    return this.announcementsService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an announcement by ID" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.announcementsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an announcement" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, dto);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Publish an announcement immediately" })
  async publish(@Param("id", ParseUUIDPipe) id: string) {
    return this.announcementsService.publish(id);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Archive an announcement" })
  async archive(@Param("id", ParseUUIDPipe) id: string) {
    return this.announcementsService.archive(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an announcement" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    await this.announcementsService.delete(id);
    return { success: true };
  }
}

/**
 * Participant announcements controller
 */
@ApiTags("Announcements")
@ApiBearerAuth()
@Controller("announcements")
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get("participant")
  @ApiOperation({ summary: "Get announcements for participant" })
  async getParticipantAnnouncements(
    @Query() query: ParticipantAnnouncementQueryDto,
    @CurrentUser() user: any,
  ) {
    const participantId = user.participantId;
    if (!participantId) {
      return { data: [], meta: { total: 0, limit: 20, offset: 0 } };
    }
    return this.announcementsService.findForParticipant(
      participantId,
      query.cohortId,
      query.limit,
      query.offset,
    );
  }

  @Get("organization")
  @ApiOperation({ summary: "Get announcements for organization" })
  async getOrganizationAnnouncements(
    @Query() query: ParticipantAnnouncementQueryDto,
    @CurrentUser() user: any,
  ) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      return { data: [], meta: { total: 0, limit: 20, offset: 0 } };
    }
    return this.announcementsService.findForOrganization(
      organizationId,
      query.cohortId,
      query.limit,
      query.offset,
    );
  }

  @Get("mentor")
  @ApiOperation({ summary: "Get announcements for mentor" })
  async getMentorAnnouncements(
    @Query() query: ParticipantAnnouncementQueryDto,
    @CurrentUser() user: any,
  ) {
    const mentorId = user.mentorId;
    if (!mentorId) {
      return { data: [], meta: { total: 0, limit: 20, offset: 0 } };
    }
    return this.announcementsService.findForMentor(
      mentorId,
      query.cohortId,
      query.limit,
      query.offset,
    );
  }

  @Post(":id/read")
  @ApiOperation({ summary: "Mark announcement as read" })
  async markAsRead(@Param("id", ParseUUIDPipe) id: string) {
    await this.announcementsService.incrementReadCount(id);
    return { success: true };
  }
}
