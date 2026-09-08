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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
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

@ApiTags("participants")
@Controller("participants")
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

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

  // ============ Admin/Staff Endpoints ============

  @Post()
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
  @ApiOperation({ summary: "Delete participant" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 204, description: "Participant deleted" })
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.participantsService.remove(id);
  }

  // ============ Bulk Import Endpoints ============

  @Post("bulk-import")
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
