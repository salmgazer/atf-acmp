import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import * as Papa from "papaparse";
import { MentorsService } from "./mentors.service";
import {
  CreateMentorDto,
  UpdateMentorDto,
  MentorQueryDto,
  PaginatedMentorsDto,
  BulkImportResultDto,
  AssignMentorDto,
  UnassignMentorDto,
  CreateSessionDto,
  UpdateSessionDto,
  SessionQueryDto,
  MentorStatisticsDto,
  MentorCapacityDto,
} from "./dto/mentor.dto";
import { Mentor, MentorSession } from "@/database/entities/mentor.entity";
import { Team } from "@/database/entities/team.entity";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { BulkThrottle, UploadThrottle } from "@/common/decorators/throttle.decorator";
import { Role } from "@/database/entities/user.entity";
import { UploadService } from "@/common/services/upload.service";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@ApiTags("Mentors")
@ApiBearerAuth()
@Controller("mentors")
@UseInterceptors(AuditInterceptor)
export class MentorsController {
  constructor(
    private readonly mentorsService: MentorsService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Mentor",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => `${result?.firstName} ${result?.lastName}`,
    getDescription: (result) => `Created mentor: ${result?.firstName} ${result?.lastName}`,
  })
  @ApiOperation({ summary: "Create a new mentor" })
  @ApiResponse({ status: 201, type: Mentor })
  async create(@Body() dto: CreateMentorDto): Promise<Mentor> {
    return this.mentorsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all mentors" })
  @ApiResponse({ status: 200, type: PaginatedMentorsDto })
  async findAll(@Query() query: MentorQueryDto): Promise<PaginatedMentorsDto> {
    return this.mentorsService.findAll(query);
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get mentor statistics" })
  @ApiResponse({ status: 200, type: MentorStatisticsDto })
  async getStatistics(
    @Query("cohortId") cohortId?: string
  ): Promise<MentorStatisticsDto> {
    return this.mentorsService.getStatistics(cohortId);
  }

  @Get("capacity")
  @ApiOperation({ summary: "Get mentor capacity list" })
  @ApiResponse({ status: 200, type: [MentorCapacityDto] })
  async getCapacityList(
    @Query("cohortId") cohortId?: string
  ): Promise<MentorCapacityDto[]> {
    return this.mentorsService.getCapacityList(cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a mentor by ID" })
  @ApiResponse({ status: 200, type: Mentor })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<Mentor> {
    return this.mentorsService.findOne(id);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Mentor",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => `${result?.firstName} ${result?.lastName}`,
    getDescription: (result) => `Updated mentor: ${result?.firstName} ${result?.lastName}`,
  })
  @ApiOperation({ summary: "Update a mentor" })
  @ApiResponse({ status: 200, type: Mentor })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMentorDto
  ): Promise<Mentor> {
    return this.mentorsService.update(id, dto);
  }

  @Post(":id/profile-picture")
  @UseInterceptors(FileInterceptor("file"))
  @UploadThrottle()
  @ApiOperation({ summary: "Upload mentor profile picture" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Profile picture image (JPEG, PNG, WebP)",
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: Mentor })
  async uploadProfilePicture(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<Mentor> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Get current mentor to check for existing image
    const mentor = await this.mentorsService.findOne(id);

    // Delete old profile picture if exists
    if (mentor.profileImageUrl) {
      const oldKey = this.uploadService.extractKeyFromUrl(mentor.profileImageUrl);
      if (oldKey) {
        await this.uploadService.deleteFile(oldKey);
      }
    }

    // Upload new image
    const result = await this.uploadService.uploadProfilePicture(file, "mentors", id);

    // Update mentor with new URL
    return this.mentorsService.update(id, { profileImageUrl: result.url });
  }

  @Post("upload-profile-picture")
  @UseInterceptors(FileInterceptor("file"))
  @UploadThrottle()
  @ApiOperation({ summary: "Upload profile picture for new mentor (before creation)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Profile picture image (JPEG, PNG, WebP)",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        key: { type: "string" },
      },
    },
  })
  async uploadProfilePictureForNew(
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const result = await this.uploadService.uploadProfilePicture(file, "mentors");
    return { url: result.url, key: result.key };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: AuditAction.DELETE,
    entityType: "Mentor",
    getEntityId: (_, args) => args[0]?.id,
    getDescription: (_, args) => `Deleted mentor: ${args[0]?.id}`,
  })
  @ApiOperation({ summary: "Delete a mentor" })
  async delete(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.mentorsService.delete(id);
  }

  // ============ Assignments ============

  @Post(":id/assign")
  @Audit({
    action: AuditAction.ASSIGNMENT,
    entityType: "MentorAssignment",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Assigned mentor to team`,
  })
  @ApiOperation({ summary: "Assign mentor to a team" })
  async assignToTeam(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignMentorDto
  ) {
    return this.mentorsService.assignToTeam(id, dto);
  }

  @Post(":id/unassign")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: AuditAction.ASSIGNMENT,
    entityType: "MentorAssignment",
    getDescription: () => `Unassigned mentor from team`,
  })
  @ApiOperation({ summary: "Unassign mentor from a team" })
  async unassignFromTeam(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UnassignMentorDto
  ): Promise<void> {
    return this.mentorsService.unassignFromTeam(id, dto);
  }

  @Get(":id/teams")
  @ApiOperation({ summary: "Get mentor's assigned teams" })
  @ApiResponse({ status: 200, type: [Team] })
  async getMentorTeams(@Param("id", ParseUUIDPipe) id: string): Promise<Team[]> {
    return this.mentorsService.getMentorTeams(id);
  }

  @Get("team/:teamId/suggest")
  @ApiOperation({ summary: "Suggest mentors for a team" })
  @ApiResponse({ status: 200, type: [Mentor] })
  async suggestMentors(
    @Param("teamId", ParseUUIDPipe) teamId: string
  ): Promise<Mentor[]> {
    return this.mentorsService.suggestMentorsForTeam(teamId);
  }

  // ============ Sessions ============

  @Post(":id/sessions")
  @ApiOperation({ summary: "Log a mentorship session" })
  @ApiResponse({ status: 201, type: MentorSession })
  async createSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateSessionDto
  ): Promise<MentorSession> {
    return this.mentorsService.createSession(id, dto);
  }

  @Get(":id/sessions")
  @ApiOperation({ summary: "Get mentor's sessions" })
  async getMentorSessions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("teamId") teamId?: string
  ): Promise<MentorSession[]> {
    return this.mentorsService.getMentorSessions(id, teamId);
  }
}

@ApiTags("Mentor Sessions")
@ApiBearerAuth()
@Controller("sessions")
export class SessionsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  @ApiOperation({ summary: "List all sessions" })
  async getSessions(@Query() query: SessionQueryDto) {
    return this.mentorsService.getSessions(query);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a session" })
  async updateSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto
  ): Promise<MentorSession> {
    return this.mentorsService.updateSession(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a session" })
  async deleteSession(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.mentorsService.deleteSession(id);
  }
}

@ApiTags("Admin - Mentors")
@ApiBearerAuth()
@Controller("admin/mentors")
@UseInterceptors(AuditInterceptor)
export class AdminMentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Post("sync-users")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.BULK_ACTION,
    entityType: "Mentor",
    getDescription: (result) => `Synced mentor users: ${result?.created || 0} created, ${result?.skipped || 0} skipped`,
  })
  @ApiOperation({ summary: "Sync mentor users - creates User records for mentors who don't have them" })
  @ApiResponse({ status: 200, schema: { type: "object", properties: { created: { type: "number" }, skipped: { type: "number" } } } })
  async syncMentorUsers(
    @Query("cohortId") cohortId?: string
  ): Promise<{ created: number; skipped: number }> {
    return this.mentorsService.syncMentorUsers(cohortId);
  }

  @Post("import/:cohortId")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @UploadThrottle()
  @Audit({
    action: AuditAction.BULK_IMPORT,
    entityType: "Mentor",
    getDescription: (result) => `Bulk imported ${result?.created || 0} mentors`,
  })
  @ApiOperation({ summary: "Bulk import mentors from CSV" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, type: BulkImportResultDto })
  async bulkImport(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<BulkImportResultDto> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const csvContent = file.buffer.toString("utf-8");
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Normalize header names
        const h = header.toLowerCase().trim().replace(/\s+/g, "_");
        const mappings: Record<string, string> = {
          first_name: "firstName",
          firstname: "firstName",
          last_name: "lastName",
          lastname: "lastName",
          email: "email",
          phone: "phone",
          phone_number: "phone",
          company: "company",
          organization: "company",
          title: "title",
          job_title: "title",
          expertise: "expertise",
          skills: "expertise",
          max_teams: "maxTeams",
          maxteams: "maxTeams",
        };
        return mappings[h] || h;
      },
    });

    if (parsed.errors.length > 0) {
      throw new BadRequestException(
        `CSV parsing error: ${parsed.errors[0].message}`
      );
    }

    const mentors = parsed.data.map((row: any) => ({
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      company: row.company,
      title: row.title,
      expertise: row.expertise
        ? row.expertise.split(",").map((e: string) => e.trim())
        : [],
      maxTeams: row.maxTeams ? parseInt(row.maxTeams, 10) : 3,
    }));

    return this.mentorsService.bulkImport(cohortId, mentors);
  }
}

// Mentor Portal Controller (for mentors themselves)
@ApiTags("Mentor Portal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("mentor-portal")
export class MentorPortalController {
  constructor(
    private readonly mentorsService: MentorsService,
    private readonly uploadService: UploadService,
  ) {}

  private async getMentorFromUser(user: { email: string }): Promise<Mentor> {
    const mentor = await this.mentorsService.findByEmail(user.email);
    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }
    return mentor;
  }

  @Get("me")
  @ApiOperation({ summary: "Get current mentor's profile" })
  async getMyProfile(@CurrentUser() user: { email: string }): Promise<Mentor> {
    const mentor = await this.getMentorFromUser(user);
    return this.mentorsService.findOne(mentor.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update current mentor's profile" })
  async updateMyProfile(
    @CurrentUser() user: { email: string },
    @Body() dto: UpdateMentorDto
  ): Promise<Mentor> {
    const mentor = await this.getMentorFromUser(user);
    // Only allow updating certain fields
    const allowedFields: UpdateMentorDto = {
      phone: dto.phone,
      bio: dto.bio,
      profileImageUrl: dto.profileImageUrl,
      expertise: dto.expertise,
      linkedinUrl: dto.linkedinUrl,
    };
    return this.mentorsService.update(mentor.id, allowedFields);
  }

  @Post("me/profile-picture")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload profile picture for current mentor" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Profile picture image (JPEG, PNG, WebP)",
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: Mentor })
  async uploadMyProfilePicture(
    @CurrentUser() user: { email: string },
    @UploadedFile() file: Express.Multer.File
  ): Promise<Mentor> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const mentor = await this.getMentorFromUser(user);

    // Delete old profile picture if exists
    if (mentor.profileImageUrl) {
      const oldKey = this.uploadService.extractKeyFromUrl(mentor.profileImageUrl);
      if (oldKey) {
        await this.uploadService.deleteFile(oldKey);
      }
    }

    // Upload new image
    const result = await this.uploadService.uploadProfilePicture(file, "mentors", mentor.id);

    // Update mentor with new URL
    return this.mentorsService.update(mentor.id, { profileImageUrl: result.url });
  }

  @Get("my/teams")
  @ApiOperation({ summary: "Get mentor's assigned teams" })
  async getMyTeams(@CurrentUser() user: { email: string }): Promise<Team[]> {
    const mentor = await this.getMentorFromUser(user);
    return this.mentorsService.getMentorTeams(mentor.id);
  }

  @Post("my/sessions")
  @ApiOperation({ summary: "Log a mentorship session" })
  async logSession(
    @CurrentUser() user: { email: string },
    @Body() dto: CreateSessionDto
  ): Promise<MentorSession> {
    const mentor = await this.getMentorFromUser(user);
    return this.mentorsService.createSession(mentor.id, dto);
  }

  @Get("my/sessions")
  @ApiOperation({ summary: "Get my sessions" })
  async getMySessions(
    @CurrentUser() user: { email: string },
    @Query("teamId") teamId?: string
  ): Promise<MentorSession[]> {
    const mentor = await this.getMentorFromUser(user);
    return this.mentorsService.getMentorSessions(mentor.id, teamId);
  }
}
