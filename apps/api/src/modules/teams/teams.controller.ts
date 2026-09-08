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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { TeamsService } from "./teams.service";
import {
  CreateTeamDto,
  UpdateTeamDto,
  TeamQueryDto,
  PaginatedTeamsDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  JoinByCodeDto,
  SendInvitationDto,
  RespondInvitationDto,
  AssignBriefDto,
  DisqualifyTeamDto,
  SearchParticipantsDto,
  TeamStatisticsDto,
} from "./dto/team.dto";
import { TeamStatus, InvitationStatus } from "@/database/entities/team.entity";

@ApiTags("teams")
@Controller("teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // ============ Team CRUD ============

  @Post()
  @ApiOperation({ summary: "Create a new team" })
  @ApiResponse({ status: 201, description: "Team created successfully" })
  async create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all teams with filters" })
  @ApiResponse({ status: 200, type: PaginatedTeamsDto })
  async findAll(@Query() query: TeamQueryDto) {
    return this.teamsService.findAll(query);
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get team statistics" })
  @ApiQuery({ name: "cohortId", required: false })
  @ApiResponse({ status: 200, type: TeamStatisticsDto })
  async getStatistics(@Query("cohortId") cohortId?: string) {
    return this.teamsService.getStatistics(cohortId);
  }

  @Get("my/:participantId")
  @ApiOperation({ summary: "Get participant's current team" })
  @ApiParam({ name: "participantId", type: "string" })
  async findParticipantTeam(@Param("participantId", ParseUUIDPipe) participantId: string) {
    return this.teamsService.findParticipantTeam(participantId);
  }

  @Get("invite/:inviteCode")
  @ApiOperation({ summary: "Get team by invite code" })
  async findByInviteCode(@Param("inviteCode") inviteCode: string) {
    return this.teamsService.findByInviteCode(inviteCode);
  }

  @Post("join")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Join a team using invite code" })
  @ApiResponse({ status: 200, description: "Successfully joined team" })
  @ApiResponse({ status: 400, description: "Cannot join team" })
  @ApiResponse({ status: 404, description: "Team not found" })
  async joinByCode(@Body() dto: JoinByCodeDto) {
    return this.teamsService.joinByInviteCode(dto.inviteCode, dto.participantId);
  }

  @Get("open/:cohortId")
  @ApiOperation({ summary: "Get teams that are open for new members" })
  @ApiParam({ name: "cohortId", type: "string" })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "List of open teams" })
  async findOpenTeams(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Query("search") search?: string
  ) {
    return this.teamsService.findOpenTeams(cohortId, search);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get team by ID" })
  @ApiParam({ name: "id", type: "string" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update team" })
  @ApiParam({ name: "id", type: "string" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto
  ) {
    return this.teamsService.update(id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update team status" })
  @ApiParam({ name: "id", type: "string" })
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("status") status: TeamStatus
  ) {
    return this.teamsService.updateStatus(id, status);
  }

  @Post(":id/assign-brief")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Assign brief to team" })
  @ApiParam({ name: "id", type: "string" })
  async assignBrief(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignBriefDto
  ) {
    return this.teamsService.assignBrief(id, dto.briefId);
  }

  @Post(":id/unassign-brief")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unassign brief from team" })
  @ApiParam({ name: "id", type: "string" })
  async unassignBrief(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.unassignBrief(id);
  }

  @Post(":id/disqualify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disqualify team" })
  @ApiParam({ name: "id", type: "string" })
  async disqualify(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DisqualifyTeamDto
  ) {
    return this.teamsService.disqualify(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete team (only FORMING status)" })
  @ApiParam({ name: "id", type: "string" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.delete(id);
  }

  // ============ Member Management ============

  @Post(":id/members")
  @ApiOperation({ summary: "Add member to team" })
  @ApiParam({ name: "id", type: "string" })
  async addMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto
  ) {
    return this.teamsService.addMember(id, dto);
  }

  @Delete(":id/members/:participantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove member from team" })
  @ApiParam({ name: "id", type: "string" })
  @ApiParam({ name: "participantId", type: "string" })
  async removeMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("participantId", ParseUUIDPipe) participantId: string
  ) {
    return this.teamsService.removeMember(id, participantId);
  }

  @Patch(":id/members/:participantId/role")
  @ApiOperation({ summary: "Update member role" })
  @ApiParam({ name: "id", type: "string" })
  @ApiParam({ name: "participantId", type: "string" })
  async updateMemberRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("participantId", ParseUUIDPipe) participantId: string,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.teamsService.updateMemberRole(id, participantId, dto.role);
  }

  // ============ Invitations ============

  @Post(":id/invitations")
  @ApiOperation({ summary: "Send invitation to participant" })
  @ApiParam({ name: "id", type: "string" })
  async sendInvitation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SendInvitationDto
  ) {
    return this.teamsService.sendInvitation(id, dto);
  }

  @Get(":id/invitations")
  @ApiOperation({ summary: "Get team invitations" })
  @ApiParam({ name: "id", type: "string" })
  async getTeamInvitations(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.getTeamInvitations(id);
  }

  // ============ Participant Search ============

  @Get("search/participants")
  @ApiOperation({ summary: "Search available participants for team invitations" })
  async searchParticipants(@Query() query: SearchParticipantsDto) {
    return this.teamsService.searchAvailableParticipants(
      query.cohortId,
      query.query,
      query.limit
    );
  }

  @Post(":id/init-chat")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Initialize chat channel for an existing team" })
  @ApiParam({ name: "id", description: "Team ID" })
  @ApiResponse({ status: 200, description: "Chat initialized" })
  async initializeTeamChat(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.initializeTeamChat(id);
  }
}

// Separate controller for invitation endpoints (participant-facing)
@ApiTags("invitations")
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get("my/:participantId")
  @ApiOperation({ summary: "Get participant's invitations" })
  @ApiParam({ name: "participantId", type: "string" })
  @ApiQuery({ name: "status", required: false, enum: InvitationStatus })
  async getMyInvitations(
    @Param("participantId", ParseUUIDPipe) participantId: string,
    @Query("status") status?: InvitationStatus
  ) {
    return this.teamsService.getParticipantInvitations(participantId, status);
  }

  @Post(":id/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept invitation" })
  @ApiParam({ name: "id", type: "string" })
  async accept(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.acceptInvitation(id);
  }

  @Post(":id/decline")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Decline invitation" })
  @ApiParam({ name: "id", type: "string" })
  async decline(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.declineInvitation(id);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel invitation (team lead/co-lead only)" })
  @ApiParam({ name: "id", type: "string" })
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("cancelledBy") cancelledBy: string
  ) {
    return this.teamsService.cancelInvitation(id, cancelledBy);
  }
}
