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
  RequestMemberRemovalDto,
  ResolveRemovalRequestDto,
  RemovalRequestQueryDto,
} from "./dto/team.dto";
import { TeamStatus, InvitationStatus } from "@/database/entities/team.entity";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@ApiTags("teams")
@Controller("teams")
@UseInterceptors(AuditInterceptor)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // ============ Team CRUD ============

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Team",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Created team: ${result?.name}`,
  })
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

  // ============ Staff: Removal Request Management ============
  // NOTE: These routes must be defined BEFORE the :id route to avoid conflicts

  @Get("admin/removal-requests")
  @ApiOperation({ summary: "Get all pending removal requests (staff only)" })
  @ApiQuery({ name: "cohortId", required: false })
  @ApiResponse({ status: 200, description: "List of pending removal requests" })
  async getAllRemovalRequests(@Query("cohortId") cohortId?: string) {
    return this.teamsService.getAllPendingRemovalRequests(cohortId);
  }

  @Post("admin/removal-requests/:requestId/approve")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.APPROVAL,
    entityType: "TeamMemberRemovalRequest",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Approved member removal request`,
  })
  @ApiOperation({ summary: "Approve a member removal request (staff only)" })
  @ApiParam({ name: "requestId", description: "Removal Request ID" })
  async approveRemovalRequest(
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: ResolveRemovalRequestDto
  ) {
    return this.teamsService.approveRemovalRequest(requestId, dto.resolvedBy, dto.notes);
  }

  @Post("admin/removal-requests/:requestId/reject")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.REJECTION,
    entityType: "TeamMemberRemovalRequest",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Rejected member removal request`,
  })
  @ApiOperation({ summary: "Reject a member removal request (staff only)" })
  @ApiParam({ name: "requestId", description: "Removal Request ID" })
  async rejectRemovalRequest(
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: ResolveRemovalRequestDto
  ) {
    return this.teamsService.rejectRemovalRequest(requestId, dto.resolvedBy, dto.notes);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get team by ID" })
  @ApiParam({ name: "id", type: "string" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Team",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Updated team: ${result?.name}`,
  })
  @ApiOperation({ summary: "Update team" })
  @ApiParam({ name: "id", type: "string" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto
  ) {
    return this.teamsService.update(id, dto);
  }

  @Patch(":id/status")
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Team",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Changed team status: ${result?.name} to ${result?.status}`,
  })
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
  @Audit({
    action: AuditAction.ASSIGNMENT,
    entityType: "Team",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Assigned brief to team: ${result?.name}`,
  })
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
  @Audit({
    action: AuditAction.ASSIGNMENT,
    entityType: "Team",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Unassigned brief from team: ${result?.name}`,
  })
  @ApiOperation({ summary: "Unassign brief from team" })
  @ApiParam({ name: "id", type: "string" })
  async unassignBrief(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.unassignBrief(id);
  }

  @Post(":id/disqualify")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Team",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Disqualified team: ${result?.name}`,
  })
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
  @Audit({
    action: AuditAction.DELETE,
    entityType: "Team",
    getEntityId: (_, args) => args[0]?.id,
    getDescription: (_, args) => `Deleted team: ${args[0]?.id}`,
  })
  @ApiOperation({ summary: "Delete team (only FORMING status)" })
  @ApiParam({ name: "id", type: "string" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.delete(id);
  }

  // ============ Member Management ============

  @Post(":id/members")
  @Audit({
    action: AuditAction.ASSIGNMENT,
    entityType: "TeamMember",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Added member to team: ${result?.name}`,
  })
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
  @Audit({
    action: AuditAction.ASSIGNMENT,
    entityType: "TeamMember",
    getDescription: () => `Removed member from team`,
  })
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

  // ============ Pending Member Management ============

  @Get(":id/pending-members")
  @ApiOperation({ summary: "Get pending members awaiting approval" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 200, description: "List of pending members" })
  async getPendingMembers(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.getPendingMembers(id);
  }

  @Post(":id/members/:memberId/confirm")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.APPROVAL,
    entityType: "TeamMember",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Confirmed pending team member`,
  })
  @ApiOperation({ summary: "Confirm a pending member (team lead/co-lead only)" })
  @ApiParam({ name: "id", description: "Team ID" })
  @ApiParam({ name: "memberId", description: "Team Member ID" })
  async confirmPendingMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Body("confirmedBy", ParseUUIDPipe) confirmedBy: string
  ) {
    return this.teamsService.confirmPendingMember(id, memberId, confirmedBy);
  }

  @Post(":id/members/:memberId/decline")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.REJECTION,
    entityType: "TeamMember",
    getDescription: () => `Declined pending team member`,
  })
  @ApiOperation({ summary: "Decline a pending member (team lead/co-lead only)" })
  @ApiParam({ name: "id", description: "Team ID" })
  @ApiParam({ name: "memberId", description: "Team Member ID" })
  async declinePendingMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Body("declinedBy", ParseUUIDPipe) declinedBy: string
  ) {
    return this.teamsService.declinePendingMember(id, memberId, declinedBy);
  }

  // ============ Member Removal Requests ============

  @Post(":id/removal-requests")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.CREATE,
    entityType: "TeamMemberRemovalRequest",
    getDescription: () => `Requested member removal from team`,
  })
  @ApiOperation({ summary: "Request to remove a member from team (team lead/co-lead only)" })
  @ApiParam({ name: "id", description: "Team ID" })
  @ApiResponse({ status: 200, description: "For pending members: immediate removal. For confirmed members: removal request created." })
  async requestMemberRemoval(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RequestMemberRemovalDto
  ) {
    return this.teamsService.requestMemberRemoval(
      id,
      dto.participantId,
      dto.requestedBy,
      dto.reason
    );
  }

  @Get(":id/removal-requests")
  @ApiOperation({ summary: "Get pending removal requests for a team" })
  @ApiParam({ name: "id", description: "Team ID" })
  async getTeamRemovalRequests(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.getPendingRemovalRequests(id);
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

  @Get(":id/sessions")
  @ApiOperation({ summary: "Get mentor sessions for a team" })
  @ApiParam({ name: "id", description: "Team ID" })
  @ApiResponse({ status: 200, description: "Upcoming and past mentor sessions" })
  async getTeamSessions(@Param("id", ParseUUIDPipe) id: string) {
    return this.teamsService.getTeamSessions(id);
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
