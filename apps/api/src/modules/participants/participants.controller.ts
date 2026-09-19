import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { ParticipantsService } from "./participants.service";
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  ParticipantQueryDto,
  PaginatedParticipantsDto,
  BulkImportParticipantsDto,
  BulkImportResultDto,
  CompleteOnboardingDto,
  OnboardingPreferencesDto,
  ParticipantStatisticsDto,
} from "./dto/participant.dto";
import { ParticipantStatus } from "@/database/entities/participant.entity";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UploadService } from "@/common/services/upload.service";
import { UploadThrottle } from "@/common/decorators/throttle.decorator";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@ApiTags("participants")
@Controller("participants")
@UseInterceptors(AuditInterceptor)
export class ParticipantsController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly uploadService: UploadService,
  ) {}

  // ============ Current Participant Endpoint ============
  
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current participant profile" })
  @ApiResponse({ status: 200, description: "Current participant details" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Participant not found" })
  async getCurrentParticipant(@CurrentUser() user: any) {
    // The user object from JWT contains the participant ID for participant users
    if (user.role !== "participant") {
      return null;
    }
    return this.participantsService.findOne(user.id);
  }

  @Post("me/profile-picture")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor("file"))
  @UploadThrottle()
  @ApiOperation({ summary: "Upload profile picture for current participant" })
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
  @ApiResponse({ status: 200, description: "Profile picture uploaded" })
  async uploadMyProfilePicture(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (user.role !== "participant") {
      throw new BadRequestException("Only participants can upload profile pictures");
    }

    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const participant = await this.participantsService.findOne(user.id);

    // Delete old profile picture if exists
    if (participant.profileImageUrl) {
      const oldKey = this.uploadService.extractKeyFromUrl(participant.profileImageUrl);
      if (oldKey) {
        await this.uploadService.deleteFile(oldKey);
      }
    }

    // Upload new image
    const result = await this.uploadService.uploadProfilePicture(file, "participants", participant.id);

    // Update participant with new URL
    return this.participantsService.update(participant.id, { profileImageUrl: result.url });
  }

  // ============ Admin/Staff Endpoints ============

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Participant",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => `${result?.firstName} ${result?.lastName}`,
    getDescription: (result) => `Created participant: ${result?.firstName} ${result?.lastName}`,
  })
  @ApiOperation({ summary: "Create a new participant" })
  @ApiResponse({ status: 201, description: "Participant created successfully" })
  @ApiResponse({ status: 409, description: "Participant already exists" })
  async create(@Body() dto: CreateParticipantDto) {
    return this.participantsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List participants with filters" })
  @ApiResponse({ status: 200, type: PaginatedParticipantsDto })
  async findAll(@Query() query: ParticipantQueryDto) {
    return this.participantsService.findAll(query);
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get participant statistics" })
  @ApiQuery({ name: "cohortId", required: false })
  @ApiResponse({ status: 200, type: ParticipantStatisticsDto })
  async getStatistics(@Query("cohortId") cohortId?: string) {
    return this.participantsService.getStatistics(cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get participant by ID" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 200, description: "Participant details" })
  @ApiResponse({ status: 404, description: "Participant not found" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.participantsService.findOne(id);
  }

  @Get("by-participant-id/:participantId")
  @ApiOperation({ summary: "Get participant by participant ID" })
  async findByParticipantId(@Param("participantId") participantId: string) {
    return this.participantsService.findByParticipantId(participantId);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Participant",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => `${result?.firstName} ${result?.lastName}`,
    getDescription: (result) => `Updated participant: ${result?.firstName} ${result?.lastName}`,
  })
  @ApiOperation({ summary: "Update participant" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 200, description: "Participant updated" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateParticipantDto
  ) {
    return this.participantsService.update(id, dto);
  }

  @Patch(":id/status")
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Participant",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => `${result?.firstName} ${result?.lastName}`,
    getDescription: (result) => `Changed participant status: ${result?.firstName} ${result?.lastName} to ${result?.status}`,
  })
  @ApiOperation({ summary: "Update participant status" })
  @ApiParam({ name: "id", type: "string" })
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("status") status: ParticipantStatus
  ) {
    return this.participantsService.updateStatus(id, status);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: AuditAction.DELETE,
    entityType: "Participant",
    getEntityId: (_, args) => args[0]?.id,
    getDescription: (_, args) => `Deleted participant: ${args[0]?.id}`,
  })
  @ApiOperation({ summary: "Delete participant" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 204, description: "Participant deleted" })
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.participantsService.remove(id);
  }

  // ============ Bulk Import Endpoints ============

  @Post("bulk-import")
  @Audit({
    action: AuditAction.BULK_IMPORT,
    entityType: "Participant",
    getDescription: (result) => `Bulk imported ${result?.created || 0} participants`,
  })
  @ApiOperation({ summary: "Bulk import participants from CSV data" })
  @ApiResponse({ status: 201, type: BulkImportResultDto })
  async bulkImport(@Body() dto: BulkImportParticipantsDto) {
    return this.participantsService.bulkImport(dto);
  }

  // ============ Onboarding Endpoints ============

  @Post(":id/onboarding")
  @ApiOperation({ summary: "Complete participant onboarding" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 200, description: "Onboarding completed" })
  async completeOnboarding(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CompleteOnboardingDto
  ) {
    return this.participantsService.completeOnboarding(id, dto);
  }

  @Get(":id/preferences")
  @ApiOperation({ summary: "Get participant preferences" })
  @ApiParam({ name: "id", type: "string" })
  async getPreferences(@Param("id", ParseUUIDPipe) id: string) {
    return this.participantsService.getPreferences(id);
  }

  @Put(":id/preferences")
  @ApiOperation({ summary: "Save participant preferences" })
  @ApiParam({ name: "id", type: "string" })
  async savePreferences(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: OnboardingPreferencesDto
  ) {
    return this.participantsService.savePreferences(id, dto);
  }

  @Put(":id/brief-rankings")
  @ApiOperation({ summary: "Update brief rankings" })
  @ApiParam({ name: "id", type: "string" })
  async updateBriefRankings(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("briefRankings") briefRankings: string[]
  ) {
    return this.participantsService.updateBriefRankings(id, briefRankings);
  }

  // ============ Password Endpoints ============

  @Post(":id/password-changed")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark password as changed" })
  @ApiParam({ name: "id", type: "string" })
  async markPasswordChanged(@Param("id", ParseUUIDPipe) id: string) {
    return this.participantsService.markPasswordChanged(id);
  }

  // ============ Team Formation Endpoints ============

  @Get("cohort/:cohortId/ready")
  @ApiOperation({ summary: "Get participants ready for team formation" })
  @ApiParam({ name: "cohortId", type: "string" })
  async findReadyForTeamFormation(
    @Param("cohortId", ParseUUIDPipe) cohortId: string
  ) {
    return this.participantsService.findReadyForTeamFormation(cohortId);
  }

  @Get("cohort/:cohortId/country/:country")
  @ApiOperation({ summary: "Get participants by country" })
  @ApiParam({ name: "cohortId", type: "string" })
  @ApiParam({ name: "country", type: "string" })
  async findByCountry(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("country") country: string
  ) {
    return this.participantsService.findByCountry(cohortId, country);
  }
}
