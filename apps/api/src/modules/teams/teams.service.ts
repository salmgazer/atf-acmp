import { assertParticipantTeamAdmission, assertMemberAdmission, teamRuleContext, clearTeamRegistration } from "@/common/services/team-rules";
import { ATF_TEAM_MAX, canShareTeam, evaluateTeamRules, normalizeTeamCountry } from "@acmp/shared";
import { resolveCohortGroup } from "@/common/services/cohort-groups";
import { briefCountry, confirmedTeamCountries, isBriefCountryAllowed } from "@/common/services/brief-country-access";
import { Transactional, afterCommit } from "@/common/decorators/transactional.decorator";
import { SocketSessionsService } from "@/auth/socket-sessions.service";
import { Optional } from "@nestjs/common";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, ILike, In, Not } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import {
  Team,
  TeamStatus,
  TeamRole,
  TeamMember,
  TeamMemberStatus,
  TeamInvitation,
  InvitationStatus,
  TeamMemberRemovalRequest,
  RemovalRequestStatus,
} from "@/database/entities/team.entity";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { ChatChannel, ChannelMember, ChannelType, SenderType } from "@/database/entities/chat.entity";
import { ScheduledSession, ScheduledSessionStatus } from "@/database/entities/mentor.entity";
import {
  CreateTeamDto,
  UpdateTeamDto,
  TeamQueryDto,
  PaginatedTeamsDto,
  AddMemberDto,
  SendInvitationDto,
  TeamStatisticsDto,
  DisqualifyTeamDto,
} from "./dto/team.dto";
import { OneSignalService } from "@/modules/notifications/onesignal.service";
import { NotificationTriggersService } from "@/modules/notifications/notification-triggers.service";
import { EmailService } from "@/email/email.service";
import { User, Role } from "@/database/entities/user.entity";

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly memberRepository: Repository<TeamMember>,
    @InjectRepository(TeamInvitation)
    private readonly invitationRepository: Repository<TeamInvitation>,
    @InjectRepository(TeamMemberRemovalRequest)
    private readonly removalRequestRepository: Repository<TeamMemberRemovalRequest>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(Brief)
    private readonly briefRepository: Repository<Brief>,
    @InjectRepository(ChatChannel)
    private readonly chatChannelRepository: Repository<ChatChannel>,
    @InjectRepository(ChannelMember)
    private readonly channelMemberRepository: Repository<ChannelMember>,
    @InjectRepository(ScheduledSession)
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly oneSignalService: OneSignalService,
    private readonly notificationTriggersService: NotificationTriggersService,
    private readonly emailService: EmailService,
    @Optional() private readonly socketSessions?: SocketSessionsService,
  ) {}

  private assertSameGroup(team: Team, participant: Participant, cohort: Cohort | null): void {
    const group = resolveCohortGroup(cohort || {}, participant.group);
    if (group !== (team.group || null)) throw new BadRequestException("Participants must belong to the same group as the team");
  }

  // ============ Helper Methods ============

  /**
   * Recalculate and update the teamsCount for a brief based on actual team assignments
   */
  private async updateBriefTeamsCount(briefId: string): Promise<void> {
    const count = await this.teamRepository.count({
      where: { 
        briefId,
        status: Not(TeamStatus.DISQUALIFIED),
      },
    });
    await this.briefRepository.update(briefId, { teamsCount: count });
  }

  // ============ Team CRUD ============

  @Transactional()
  async create(dto: CreateTeamDto): Promise<Team> {
    // Verify cohort exists
    const cohort = await this.cohortRepository.findOne({
      where: { id: dto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    // Verify creator exists and is in the cohort
    const creator = await this.participantRepository.findOne({
      where: { id: dto.creatorId, cohortId: dto.cohortId },
    });
    if (!creator) {
      throw new NotFoundException("Participant not found in this cohort");
    }

    // Check if participant is already in a team
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId: dto.creatorId },
      relations: ["team"],
    });
    if (existingMembership) {
      throw new ConflictException("Participant is already in a team");
    }

    resolveCohortGroup(cohort, creator.group);
    await assertParticipantTeamAdmission(this.teamRepository.manager, cohort, creator.id);

    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    // Create team
    const team = this.teamRepository.create({
      name: dto.name,
      description: dto.description,
      cohortId: dto.cohortId,
      group: resolveCohortGroup(cohort, creator.group),
      inviteCode,
      status: TeamStatus.FORMING,
    });

    const savedTeam = await this.teamRepository.save(team);

    // Add creator as team lead (CONFIRMED since they're the creator)
    const member = this.memberRepository.create({
      teamId: savedTeam.id,
      participantId: dto.creatorId,
      role: TeamRole.LEAD,
      status: TeamMemberStatus.CONFIRMED,
      confirmedAt: new Date(),
    });
    await this.memberRepository.save(member);

    // Update participant status
    await this.participantRepository.update(dto.creatorId, {
      status: ParticipantStatus.ASSIGNED,
    });

    // Create team chat channel
    await this.createTeamChatChannel(savedTeam, creator);

    return this.findOne(savedTeam.id);
  }

  async findAll(query: TeamQueryDto): Promise<PaginatedTeamsDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.teamRepository
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.members", "members")
      .leftJoinAndSelect("members.participant", "participant")
      .leftJoinAndSelect("team.brief", "brief")
      .leftJoinAndSelect("brief.organization", "organization")
      .leftJoinAndSelect("team.cohort", "cohort")
      .leftJoinAndSelect("team.mentor", "mentor");

    if (query.cohortId) {
      qb.andWhere("team.cohortId = :cohortId", { cohortId: query.cohortId });
    }

    if (query.group && query.ungrouped) throw new BadRequestException("Choose a group or ungrouped teams");
    if (query.group) qb.andWhere("team.group = :group", { group: query.group });
    if (query.ungrouped) qb.andWhere("team.group IS NULL");

    if (query.status) {
      qb.andWhere("team.status = :status", { status: query.status });
    }

    if (query.briefId) {
      qb.andWhere("team.briefId = :briefId", { briefId: query.briefId });
    }

    if (query.organizationId) {
      qb.andWhere("brief.organizationId = :organizationId", { organizationId: query.organizationId });
    }

    if (query.hasbrief !== undefined) {
      if (query.hasbrief) {
        qb.andWhere("team.briefId IS NOT NULL");
      } else {
        qb.andWhere("team.briefId IS NULL");
      }
    }

    if (query.search) {
      qb.andWhere("LOWER(team.name) LIKE :search", {
        search: `%${query.search.toLowerCase()}%`,
      });
    }

    qb.orderBy("team.createdAt", "DESC").skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: [
        "members",
        "members.participant",
        "brief",
        "brief.organization",
        "brief.vertical",
        "cohort",
        "invitations",
        "invitations.participant",
        "mentor",
      ],
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    return team;
  }

  async findByInviteCode(inviteCode: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { inviteCode },
      relations: ["members", "members.participant", "cohort"],
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    return team;
  }

  @Transactional()
  async joinByInviteCode(inviteCode: string, participantId: string): Promise<Team> {
    const team = await this.findByInviteCode(inviteCode);

    // Check if team is still forming
    if (team.status !== TeamStatus.FORMING) {
      throw new BadRequestException("Team is no longer accepting new members");
    }

    // Get cohort for team size limits
    const cohort = await this.cohortRepository.findOne({
      where: { id: team.cohortId },
    });

    // Check team size (count only confirmed members)
    const confirmedMemberCount = team.members.filter(
      (m) => m.status === TeamMemberStatus.CONFIRMED
    ).length;
    if (confirmedMemberCount >= Math.min(ATF_TEAM_MAX, cohort?.teamSizeMax || ATF_TEAM_MAX)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Verify participant exists and is in the same cohort
    const participant = await this.participantRepository.findOne({
      where: { id: participantId, cohortId: team.cohortId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this cohort");
    }
    this.assertSameGroup(team, participant, cohort);

    // Check if participant is already in a team (confirmed or pending)
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId },
    });
    if (existingMembership) {
      if (existingMembership.status === TeamMemberStatus.PENDING) {
        throw new ConflictException("You already have a pending join request");
      }
      throw new ConflictException("You are already in a team");
    }

    // Add as PENDING member (requires team lead approval)
    await assertMemberAdmission(this.teamRepository.manager, team.id, participantId);

    const member = this.memberRepository.create({
      teamId: team.id,
      participantId,
      role: TeamRole.MEMBER,
      status: TeamMemberStatus.PENDING,
    });
    await this.memberRepository.save(member);

    // Note: DO NOT update participant status yet - they're still not confirmed
    // DO NOT add to chat channel yet - they need to be confirmed first

    // Get team leads and co-leads to notify
    const teamLeaders = team.members.filter(
      (m) => [TeamRole.LEAD, TeamRole.CO_LEAD].includes(m.role) && m.status === TeamMemberStatus.CONFIRMED
    );
    const participantName = `${participant.firstName} ${participant.lastName}`;

    // Send notifications to all team leads and co-leads
    for (const leader of teamLeaders) {
      // Push notification
      this.oneSignalService.sendToExternalUserIds(
        [`participant:${leader.participantId}`],
        {
          title: "New Join Request",
          body: `${participantName} wants to join "${team.name}". Review their request.`,
          data: {
            type: "team_join_request",
            teamId: team.id,
            teamName: team.name,
            participantId: participant.id,
            participantName,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send join request push: ${err.message}`));

      // In-app notification
      this.notificationTriggersService.onTeamJoinRequest({
        teamLeaderId: leader.participantId,
        teamId: team.id,
        teamName: team.name,
        requesterName: participantName,
        requesterId: participant.id,
      }).catch((err) => this.logger.warn(`Failed to send join request in-app notification: ${err.message}`));

      // Email notification - need to get leader's participant info
      const leaderParticipant = await this.participantRepository.findOne({
        where: { id: leader.participantId },
      });
      if (leaderParticipant) {
        this.emailService.sendTeamJoinRequestEmail({
          to: leaderParticipant.email,
          leaderFirstName: leaderParticipant.firstName,
          requesterName: participantName,
          teamName: team.name,
        }).catch((err) => this.logger.warn(`Failed to send join request email: ${err.message}`));
      }
    }

    return this.findOne(team.id);
  }

  /**
   * Confirm a pending member (called by team lead/co-lead)
   */
  @Transactional()
  async confirmPendingMember(teamId: string, memberId: string, confirmedBy: string): Promise<TeamMember> {
    const team = await this.findOne(teamId);

    // Verify confirmer is team lead or co-lead
    const confirmerMember = team.members.find((m) => m.participantId === confirmedBy);
    if (!confirmerMember || ![TeamRole.LEAD, TeamRole.CO_LEAD].includes(confirmerMember.role)) {
      throw new ForbiddenException("Only team leads or co-leads can confirm members");
    }

    // Find the pending member
    const pendingMember = team.members.find(
      (m) => m.id === memberId && m.status === TeamMemberStatus.PENDING
    );
    if (!pendingMember) {
      throw new NotFoundException("Pending member not found");
    }

    // Get cohort for team size limits
    const cohort = await this.cohortRepository.findOne({
      where: { id: team.cohortId },
    });

    // Check team size (count only confirmed members)
    const confirmedMemberCount = team.members.filter(
      (m) => m.status === TeamMemberStatus.CONFIRMED
    ).length;
    if (confirmedMemberCount >= Math.min(ATF_TEAM_MAX, cohort?.teamSizeMax || ATF_TEAM_MAX)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    await assertMemberAdmission(this.teamRepository.manager, teamId, pendingMember.participantId);

    // Atomic transition: a concurrent withdrawal must never be resurrected by save().
    const confirmation = { status: TeamMemberStatus.CONFIRMED, confirmedAt: new Date(), confirmedBy };
    const updated = await this.memberRepository.update({ id: pendingMember.id, teamId, status: TeamMemberStatus.PENDING }, confirmation);
    if (!updated.affected) throw new ConflictException("This join request changed. Refresh the team before confirming it.");
    Object.assign(pendingMember, confirmation);
    await clearTeamRegistration(this.teamRepository.manager, teamId);

    // Now update participant status to ASSIGNED
    await this.participantRepository.update(pendingMember.participantId, {
      status: ParticipantStatus.ASSIGNED,
    });

    // Add member to team chat channel
    const participant = await this.participantRepository.findOne({
      where: { id: pendingMember.participantId },
    });
    if (participant) {
      await this.addMemberToTeamChat(teamId, participant);
    }

    // Cancel any other pending memberships this participant might have
    await this.memberRepository.delete({
      participantId: pendingMember.participantId,
      status: TeamMemberStatus.PENDING,
      id: Not(pendingMember.id),
    });

    // Send push notification and in-app notification to the confirmed member
    if (participant) {
      // Push notification
      this.oneSignalService.sendToExternalUserIds(
        [`participant:${participant.id}`],
        {
          title: "You're In! 🎉",
          body: `Your request to join "${team.name}" has been approved!`,
          data: {
            type: "team_join_confirmed",
            teamId: team.id,
            teamName: team.name,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send confirmation push: ${err.message}`));

      // In-app notification
      this.notificationTriggersService.onTeamJoinConfirmed({
        participantId: participant.id,
        teamId: team.id,
        teamName: team.name,
      }).catch((err) => this.logger.warn(`Failed to send confirmation in-app notification: ${err.message}`));
    }

    return pendingMember;
  }

  /**
   * Decline a pending member (called by team lead/co-lead)
   */
  @Transactional()
  async declinePendingMember(teamId: string, memberId: string, declinedBy: string): Promise<void> {
    const team = await this.findOne(teamId);

    // Verify decliner is team lead or co-lead
    const declinerMember = team.members.find((m) => m.participantId === declinedBy);
    if (!declinerMember || ![TeamRole.LEAD, TeamRole.CO_LEAD].includes(declinerMember.role)) {
      throw new ForbiddenException("Only team leads or co-leads can decline members");
    }

    // Find the pending member
    const pendingMember = team.members.find(
      (m) => m.id === memberId && m.status === TeamMemberStatus.PENDING
    );
    if (!pendingMember) {
      throw new NotFoundException("Pending member not found");
    }

    // Get participant info before removing
    const participant = await this.participantRepository.findOne({
      where: { id: pendingMember.participantId },
    });

    // Remove the pending membership
    await this.memberRepository.remove(pendingMember);

    // Send push notification and in-app notification to the declined member
    if (participant) {
      // Push notification
      this.oneSignalService.sendToExternalUserIds(
        [`participant:${participant.id}`],
        {
          title: "Join Request Declined",
          body: `Your request to join "${team.name}" was not accepted. You can try joining other teams.`,
          data: {
            type: "team_join_declined",
            teamId: team.id,
            teamName: team.name,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send decline push: ${err.message}`));

      // In-app notification
      this.notificationTriggersService.onTeamJoinDeclined({
        participantId: participant.id,
        teamId: team.id,
        teamName: team.name,
      }).catch((err) => this.logger.warn(`Failed to send decline in-app notification: ${err.message}`));
    }
  }

  /**
   * Get pending members for a team (for team lead view)
   */
  async getPendingMembers(teamId: string): Promise<TeamMember[]> {
    return this.memberRepository.find({
      where: { teamId, status: TeamMemberStatus.PENDING },
      relations: ["participant"],
      order: { joinedAt: "ASC" },
    });
  }

  // ============ Member Removal Requests ============

  /**
   * Request to remove a member from the team (called by team lead/co-lead)
   * - For PENDING members: immediate removal (no approval needed)
   * - For CONFIRMED members: creates removal request for staff approval
   */
  async requestMemberRemoval(
    teamId: string,
    participantId: string,
    requestedBy: string,
    reason?: string
  ): Promise<{ immediate: boolean; request?: TeamMemberRemovalRequest }> {
    const team = await this.findOne(teamId);

    // Verify requester is team lead or co-lead
    const requesterMember = team.members.find((m) => m.participantId === requestedBy);
    if (!requesterMember || ![TeamRole.LEAD, TeamRole.CO_LEAD].includes(requesterMember.role)) {
      throw new ForbiddenException("Only team leads or co-leads can request member removal");
    }

    // Find the member to remove
    const memberToRemove = team.members.find((m) => m.participantId === participantId);
    if (!memberToRemove) {
      throw new NotFoundException("Member not found in team");
    }

    // Cannot remove yourself
    if (participantId === requestedBy) {
      throw new BadRequestException("You cannot remove yourself. Use the leave team function instead.");
    }

    // Cannot remove the team lead
    if (memberToRemove.role === TeamRole.LEAD) {
      throw new BadRequestException("Cannot remove the team lead");
    }

    // For PENDING members: immediate removal (no approval needed)
    if (memberToRemove.status === TeamMemberStatus.PENDING) {
      await this.memberRepository.remove(memberToRemove);
      
      // Notify the declined member
      const participant = await this.participantRepository.findOne({
        where: { id: participantId },
      });
      if (participant) {
        this.oneSignalService.sendToExternalUserIds(
          [`participant:${participant.id}`],
          {
            title: "Join Request Removed",
            body: `Your request to join "${team.name}" was declined.`,
            data: {
              type: "team_join_declined",
              teamId: team.id,
              teamName: team.name,
            },
            url: "/participant/team",
          }
        ).catch((err) => this.logger.warn(`Failed to send removal push: ${err.message}`));
      }

      return { immediate: true };
    }

    // For CONFIRMED members: create removal request for staff approval
    // Check if there's already a pending removal request
    const existingRequest = await this.removalRequestRepository.findOne({
      where: {
        teamId,
        participantId,
        status: RemovalRequestStatus.PENDING,
      },
    });
    if (existingRequest) {
      throw new ConflictException("A removal request for this member is already pending");
    }

    const removalRequest = this.removalRequestRepository.create({
      teamId,
      memberId: memberToRemove.id,
      participantId,
      requestedBy,
      reason,
      status: RemovalRequestStatus.PENDING,
    });

    const savedRequest = await this.removalRequestRepository.save(removalRequest);

    // Get requester info for notification
    const requester = await this.participantRepository.findOne({
      where: { id: requestedBy },
    });
    const memberParticipant = await this.participantRepository.findOne({
      where: { id: participantId },
    });

    // Notify staff about the removal request (Program Managers)
    const staffUsers = await this.userRepository.find({
      where: { role: In([Role.PROGRAM_MANAGER, Role.SUPER_ADMIN]), isActive: true },
      select: ["id"],
    });
    
    if (staffUsers.length > 0) {
      const staffUserIds = staffUsers.map((u) => u.id);
      const requesterName = requester 
        ? `${requester.firstName} ${requester.lastName}` 
        : "A team lead";
      const memberName = memberParticipant 
        ? `${memberParticipant.firstName} ${memberParticipant.lastName}` 
        : "a member";

      this.notificationTriggersService.onTeamMemberRemovalRequested({
        staffUserIds,
        teamId,
        teamName: team.name,
        memberName,
        requesterName,
        requestId: savedRequest.id,
        reason,
      }).catch((err) => this.logger.warn(`Failed to send removal request notification: ${err.message}`));

      this.logger.log(
        `Member removal request created: ${requesterName} ` +
        `requested to remove ${memberName} ` +
        `from team "${team.name}". Notified ${staffUserIds.length} staff members.`
      );
    }

    return { immediate: false, request: savedRequest };
  }

  /**
   * Get pending removal requests for a team
   */
  async getPendingRemovalRequests(teamId: string): Promise<TeamMemberRemovalRequest[]> {
    return this.removalRequestRepository.find({
      where: { teamId, status: RemovalRequestStatus.PENDING },
      relations: ["participant", "requester", "member"],
      order: { requestedAt: "ASC" },
    });
  }

  /**
   * Get all pending removal requests (for staff view)
   */
  async getAllPendingRemovalRequests(cohortId?: string): Promise<TeamMemberRemovalRequest[]> {
    const queryBuilder = this.removalRequestRepository
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.team", "team")
      .leftJoinAndSelect("request.participant", "participant")
      .leftJoinAndSelect("request.requester", "requester")
      .where("request.status = :status", { status: RemovalRequestStatus.PENDING });

    if (cohortId) {
      queryBuilder.andWhere("team.cohortId = :cohortId", { cohortId });
    }

    return queryBuilder.orderBy("request.requestedAt", "ASC").getMany();
  }

  /**
   * Approve a member removal request (staff only)
   */
  @Transactional()
  async approveRemovalRequest(
    requestId: string,
    approvedBy: string,
    notes?: string
  ): Promise<TeamMemberRemovalRequest> {
    const request = await this.removalRequestRepository.findOne({
      where: { id: requestId },
      relations: ["team", "participant", "requester", "member"],
    });

    if (!request) {
      throw new NotFoundException("Removal request not found");
    }

    if (request.status !== RemovalRequestStatus.PENDING) {
      throw new BadRequestException("Request has already been processed");
    }

    // Remove the member from the team
    if (request.member) {
      await this.memberRepository.remove(request.member);
      await clearTeamRegistration(this.teamRepository.manager, request.teamId);

      // Clear the member reference since the member no longer exists
      request.memberId = null;
      request.member = null;

      // Update participant status
      await this.participantRepository.update(request.participantId, {
        status: ParticipantStatus.READY,
      });

      // Remove from chat channel
      await this.removeMemberFromTeamChat(request.teamId, request.participantId);
    }

    // Update the request
    request.status = RemovalRequestStatus.APPROVED;
    request.resolvedAt = new Date();
    request.resolvedBy = approvedBy;
    request.resolutionNotes = notes;

    const savedRequest = await this.removalRequestRepository.save(request);

    // Notify the removed member
    if (request.participant) {
      this.oneSignalService.sendToExternalUserIds(
        [`participant:${request.participantId}`],
        {
          title: "Removed from Team",
          body: `You have been removed from "${request.team?.name}".`,
          data: {
            type: "team_member_removed",
            teamId: request.teamId,
            teamName: request.team?.name,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send removal notification: ${err.message}`));
    }

    // Notify the team lead about the approved removal
    const team = await this.findOne(request.teamId);
    const teamLead = team.members.find((m) => m.role === TeamRole.LEAD);
    if (teamLead) {
      this.oneSignalService.sendToExternalUserIds(
        [`participant:${teamLead.participantId}`],
        {
          title: "Removal Request Approved",
          body: `${request.participant?.firstName} ${request.participant?.lastName} has been removed from your team.`,
          data: {
            type: "removal_request_approved",
            teamId: request.teamId,
            participantId: request.participantId,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send approval notification: ${err.message}`));
    }

    return savedRequest;
  }

  /**
   * Reject a member removal request (staff only)
   */
  @Transactional()
  async rejectRemovalRequest(
    requestId: string,
    rejectedBy: string,
    notes?: string
  ): Promise<TeamMemberRemovalRequest> {
    const request = await this.removalRequestRepository.findOne({
      where: { id: requestId },
      relations: ["team", "participant", "requester"],
    });

    if (!request) {
      throw new NotFoundException("Removal request not found");
    }

    if (request.status !== RemovalRequestStatus.PENDING) {
      throw new BadRequestException("Request has already been processed");
    }

    // Update the request
    request.status = RemovalRequestStatus.REJECTED;
    request.resolvedAt = new Date();
    request.resolvedBy = rejectedBy;
    request.resolutionNotes = notes;

    const savedRequest = await this.removalRequestRepository.save(request);

    // Notify the team lead about the rejected removal
    const team = await this.findOne(request.teamId);
    const teamLead = team.members.find((m) => m.role === TeamRole.LEAD);
    if (teamLead) {
      this.oneSignalService.sendToExternalUserIds(
        [`participant:${teamLead.participantId}`],
        {
          title: "Removal Request Rejected",
          body: `Your request to remove ${request.participant?.firstName} ${request.participant?.lastName} was not approved.${notes ? ` Reason: ${notes}` : ""}`,
          data: {
            type: "removal_request_rejected",
            teamId: request.teamId,
            participantId: request.participantId,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send rejection notification: ${err.message}`));
    }

    return savedRequest;
  }

  async findOpenTeams(cohortId: string, search?: string, participantId?: string): Promise<Team[]> {
    // Get cohort for max team size
    const cohort = await this.cohortRepository.findOne({
      where: { id: cohortId },
    });
    const maxTeamSize = Math.min(ATF_TEAM_MAX, cohort?.teamSizeMax || ATF_TEAM_MAX);
    const requester = participantId ? await this.participantRepository.findOne({ where: { id: participantId, cohortId }, relations: ["preference"] }) : null;
    if (participantId && !requester) throw new NotFoundException("Participant not found in this cohort");

    const queryBuilder = this.teamRepository
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.members", "member")
      .leftJoinAndSelect("member.participant", "participant")
      .leftJoinAndSelect("team.cohort", "cohort")
      .where("team.cohortId = :cohortId", { cohortId })
      .andWhere("team.status = :status", { status: TeamStatus.FORMING });

    if (search) {
      queryBuilder.andWhere(
        "(LOWER(team.name) LIKE LOWER(:search) OR LOWER(team.description) LIKE LOWER(:search))",
        { search: `%${search}%` }
      );
    }

    const teams = await queryBuilder.getMany();
    // Preferences are used internally only; do not attach matching profiles to
    // the returned team/member objects or trust caller-supplied consent flags.
    const ids = [...new Set(teams.flatMap(team => team.members.filter(member => member.status === TeamMemberStatus.CONFIRMED).map(member => member.participantId)))];
    const profiles = requester && ids.length ? await this.participantRepository.find({ where: { id: In(ids), cohortId }, relations: ["preference"] }) : [];
    const byId = new Map(profiles.map(profile => [profile.id, profile]));

    // Filter to only teams with available spots (count only confirmed members)
    return teams.filter((team) => {
      const confirmed = team.members.filter(
        (m) => m.status === TeamMemberStatus.CONFIRMED
      );
      if (confirmed.length >= maxTeamSize) return false;
      if (!requester) return true;
      const members = confirmed.map(member => byId.get(member.participantId));
      return (team.group || null) === (requester.group || null)
        && members.every((member): member is Participant => !!member)
        && canShareTeam([...members, requester]);
    });
  }

  async findParticipantTeam(participantId: string): Promise<Team | null> {
    const confirmed = await this.memberRepository.findOne({ where: { participantId, status: TeamMemberStatus.CONFIRMED } });
    const membership = confirmed || await this.memberRepository.findOne({
      where: { participantId, status: TeamMemberStatus.PENDING },
      relations: ["team"],
    });

    if (!membership) {
      return null;
    }

    return this.findOne(membership.teamId);
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);
    Object.assign(team, dto);
    await this.teamRepository.save(team);
    return this.findOne(id);
  }

  async updateStatus(id: string, status: TeamStatus): Promise<Team> {
    const team = await this.findOne(id);
    if (status !== TeamStatus.FORMING && status !== TeamStatus.DISQUALIFIED) throw new BadRequestException("Use Register team and Start challenge after all eligibility checks pass");
    team.status = status;
    team.registeredAt = null; team.challengeStartedAt = null;
    await this.teamRepository.save(team);
    return team;
  }

  async eligibility(id: string) { return (await teamRuleContext(this.teamRepository.manager, id)).report; }

  @Transactional("team-registration")
  async registerTeam(id: string, competitionCountry: string) {
    await this.teamRepository.manager.query("SELECT id FROM teams WHERE id = $1 FOR UPDATE", [id]);
    const { team, members } = await teamRuleContext(this.teamRepository.manager, id);
    if (team.status === TeamStatus.DISQUALIFIED) throw new BadRequestException("Disqualified teams cannot register");
    const country = normalizeTeamCountry(competitionCountry);
    const report = evaluateTeamRules(team.cohort, members, { competitionCountry: country, hasBrief: !!team.briefId, problemCountry: team.brief ? briefCountry(team.brief) : undefined });
    if (!report.canRegister) throw new BadRequestException(report.registrationIssues.map(issue => issue.message).join("; "));
    await this.teamRepository.update(id, { competitionCountry: country, registeredAt: new Date(), challengeStartedAt: null, status: TeamStatus.FORMING });
    return this.findOne(id);
  }

  @Transactional("team-registration")
  async startChallenge(id: string) {
    await this.teamRepository.manager.query("SELECT id FROM teams WHERE id = $1 FOR UPDATE", [id]);
    const { team, report } = await teamRuleContext(this.teamRepository.manager, id);
    if (team.status === TeamStatus.DISQUALIFIED) throw new BadRequestException("Disqualified teams cannot start");
    if (!report.canStartChallenge) throw new BadRequestException(report.challengeIssues.map(issue => issue.message).join("; "));
    if (!team.challengeStartedAt) await this.teamRepository.update(id, { challengeStartedAt: new Date(), status: TeamStatus.ACTIVE });
    return this.findOne(id);
  }

  @Transactional()
  async assignBrief(id: string, briefId: string): Promise<Team> {
    const team = await this.findOne(id);
    const previousBriefId = team.briefId;

    const brief = await this.briefRepository.findOne({
      where: { id: briefId, cohortId: team.cohortId, status: BriefStatus.APPROVED },
      relations: ["organization"],
    });
    if (!brief) {
      throw new NotFoundException("Brief not found");
    }

    // Check if brief has capacity (exclude current team if reassigning same brief)
    const assignedTeamsCount = await this.teamRepository.count({
      where: { 
        briefId,
        status: Not(TeamStatus.DISQUALIFIED),
      },
    });
    if (assignedTeamsCount >= brief.maxTeams && previousBriefId !== briefId) {
      throw new BadRequestException("Brief has reached maximum team capacity");
    }

    // Update team with new brief
    if (!isBriefCountryAllowed(brief, confirmedTeamCountries(team.members, team.cohortId))) throw new BadRequestException("The brief's problem country must match a confirmed team member's country");
    const updateData: any = { briefId, competitionCountry: briefCountry(brief) };
    updateData.challengeStartedAt = null;
    updateData.status = TeamStatus.FORMING;
    await this.teamRepository.update(id, updateData);

    // Recalculate counts for affected briefs
    if (previousBriefId && previousBriefId !== briefId) {
      await this.updateBriefTeamsCount(previousBriefId);
    }
    if (previousBriefId !== briefId) {
      await this.updateBriefTeamsCount(briefId);
    }

    return this.findOne(id);
  }

  @Transactional()
  async unassignBrief(id: string): Promise<Team> {
    const team = await this.findOne(id);

    if (!team.briefId) {
      throw new BadRequestException("Team does not have an assigned brief");
    }

    const previousBriefId = team.briefId;

    // Update the team to remove the brief assignment
    await this.teamRepository.update(id, { briefId: null as any, challengeStartedAt: null, status: TeamStatus.FORMING });

    // Recalculate the brief's teamsCount
    await this.updateBriefTeamsCount(previousBriefId);

    return this.findOne(id);
  }

  @Transactional()
  async disqualify(id: string, dto: DisqualifyTeamDto): Promise<Team> {
    const team = await this.findOne(id);

    if (team.status === TeamStatus.DISQUALIFIED) {
      throw new BadRequestException("Team is already disqualified");
    }

    const briefIdToUpdate = team.briefId;

    team.status = TeamStatus.DISQUALIFIED;
    team.disqualificationReason = dto.reason;
    team.disqualifiedAt = new Date();
    team.disqualifiedBy = dto.disqualifiedBy;

    await this.teamRepository.save(team);

    // Recalculate brief's team count if team had an assigned brief
    if (briefIdToUpdate) {
      await this.updateBriefTeamsCount(briefIdToUpdate);
    }

    return team;
  }

  @Transactional()
  async delete(id: string): Promise<void> {
    const team = await this.findOne(id);

    if (team.status !== TeamStatus.FORMING) {
      throw new BadRequestException("Can only delete teams in FORMING status");
    }

    // Update participant statuses back to READY
    for (const member of team.members) {
      await this.participantRepository.update(member.participantId, {
        status: ParticipantStatus.READY,
      });
    }

    await this.teamRepository.softRemove(team);
  }

  // ============ Member Management ============

  @Transactional()
  async addMember(teamId: string, dto: AddMemberDto): Promise<TeamMember> {
    const team = await this.findOne(teamId);

    // Get cohort for team size limits
    const cohort = await this.cohortRepository.findOne({
      where: { id: team.cohortId },
    });

    // Check team size
    if (team.members.filter(member => member.status === TeamMemberStatus.CONFIRMED).length >= Math.min(ATF_TEAM_MAX, cohort?.teamSizeMax || ATF_TEAM_MAX)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Verify participant exists and is in the cohort
    const participant = await this.participantRepository.findOne({
      where: { id: dto.participantId, cohortId: team.cohortId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this cohort");
    }
    this.assertSameGroup(team, participant, cohort);

    // Check if participant is already in a team
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId: dto.participantId },
    });
    if (existingMembership) {
      throw new ConflictException("Participant is already in a team");
    }

    await assertMemberAdmission(this.teamRepository.manager, teamId, dto.participantId);

    const member = this.memberRepository.create({
      teamId,
      participantId: dto.participantId,
      role: dto.role || TeamRole.MEMBER,
      status: TeamMemberStatus.CONFIRMED, // Staff-added members are auto-confirmed
      confirmedAt: new Date(),
    });

    await this.memberRepository.save(member);
    await clearTeamRegistration(this.teamRepository.manager, teamId);

    // Update participant status
    await this.participantRepository.update(dto.participantId, {
      status: ParticipantStatus.ASSIGNED,
    });

    // Add member to team chat channel
    await this.addMemberToTeamChat(teamId, participant);

    return member;
  }

  @Transactional()
  async withdrawJoinRequest(teamId: string, participantId: string): Promise<void> {
    const removed = await this.memberRepository.delete({ teamId, participantId, status: TeamMemberStatus.PENDING });
    if (!removed.affected) throw new ConflictException("This join request was already approved or withdrawn. Refresh your team before trying again.");
  }

  @Transactional()
  async removeMember(teamId: string, participantId: string): Promise<void> {
    const team = await this.findOne(teamId);

    const member = team.members.find((m) => m.participantId === participantId);
    if (!member) {
      throw new NotFoundException("Member not found in team");
    }

    // Cannot remove lead if there are other confirmed members
    const confirmedMembers = team.members.filter((m) => m.status === TeamMemberStatus.CONFIRMED);
    if (member.role === TeamRole.LEAD && confirmedMembers.length > 1) {
      throw new BadRequestException(
        "Cannot remove team lead. Transfer leadership first or remove all other members."
      );
    }

    await this.memberRepository.remove(member);
    if (member.status === TeamMemberStatus.CONFIRMED) await clearTeamRegistration(this.teamRepository.manager, teamId);

    // Only update participant status if they were confirmed
    if (member.status === TeamMemberStatus.CONFIRMED) {
      await this.participantRepository.update(participantId, {
        status: ParticipantStatus.READY,
      });

      // Remove member from team chat channel
      await this.removeMemberFromTeamChat(teamId, participantId);
    }

    // If team is empty (no confirmed members), delete it (and archive the chat)
    if (confirmedMembers.length === 1 && member.status === TeamMemberStatus.CONFIRMED) {
      await this.archiveTeamChat(teamId);
      await this.teamRepository.softRemove(team);
    }
  }

  @Transactional()
  async updateMemberRole(
    teamId: string,
    participantId: string,
    role: TeamRole
  ): Promise<TeamMember> {
    const team = await this.findOne(teamId);

    const member = team.members.find((m) => m.participantId === participantId);
    if (!member) {
      throw new NotFoundException("Member not found in team");
    }

    // If setting a new lead, demote current lead
    if (role === TeamRole.LEAD) {
      const currentLead = team.members.find((m) => m.role === TeamRole.LEAD);
      if (currentLead && currentLead.participantId !== participantId) {
        currentLead.role = TeamRole.MEMBER;
        await this.memberRepository.save(currentLead);
      }
    }

    member.role = role;
    return this.memberRepository.save(member);
  }

  // ============ Invitations ============

  async sendInvitation(teamId: string, dto: SendInvitationDto): Promise<TeamInvitation> {
    const team = await this.findOne(teamId);

    // Verify inviter is a team lead or co-lead
    const inviterMember = team.members.find((m) => m.participantId === dto.invitedBy);
    if (!inviterMember || ![TeamRole.LEAD, TeamRole.CO_LEAD].includes(inviterMember.role)) {
      throw new ForbiddenException("Only team leads or co-leads can send invitations");
    }

    // Check team size
    const cohort = await this.cohortRepository.findOne({
      where: { id: team.cohortId },
    });
    if (team.members.filter(member => member.status === TeamMemberStatus.CONFIRMED).length >= Math.min(ATF_TEAM_MAX, cohort?.teamSizeMax || ATF_TEAM_MAX)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Verify participant exists
    const participant = await this.participantRepository.findOne({
      where: { id: dto.participantId, cohortId: team.cohortId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this cohort");
    }
    this.assertSameGroup(team, participant, cohort);

    // Verify participant has completed onboarding and is ready
    // This ensures they have logged in and set up their account before receiving invitations
    if (!participant.onboardingComplete) {
      throw new BadRequestException(
        "This participant has not completed their onboarding yet. They need to log in and complete their profile first before they can receive team invitations."
      );
    }
    if (participant.status !== ParticipantStatus.READY) {
      throw new BadRequestException(
        "This participant is not ready to join a team. They need to complete their account setup first."
      );
    }

    // Check if participant is already in a team
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId: dto.participantId },
    });
    if (existingMembership) {
      throw new ConflictException("Participant is already in a team");
    }

    // Check for existing pending invitation
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        teamId,
        participantId: dto.participantId,
        status: InvitationStatus.PENDING,
      },
    });
    if (existingInvitation) {
      throw new ConflictException("Invitation already sent to this participant");
    }

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await assertMemberAdmission(this.teamRepository.manager, teamId, dto.participantId);

    const invitation = this.invitationRepository.create({
      teamId,
      participantId: dto.participantId,
      invitedBy: dto.invitedBy,
      message: dto.message,
      expiresAt,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Send push notification to invited participant
    const inviter = await this.participantRepository.findOne({
      where: { id: dto.invitedBy },
    });
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : "Someone";

    this.oneSignalService.sendToExternalUserIds(
      [`participant:${dto.participantId}`],
      {
        title: "Team Invitation",
        body: `${inviterName} invited you to join "${team.name}"`,
        data: {
          type: "team_invitation",
          invitationId: savedInvitation.id,
          teamId: team.id,
          teamName: team.name,
        },
        url: "/participant/team",
      }
    ).catch((err) => this.logger.warn(`Failed to send invitation push: ${err.message}`));

    // Send email to invited participant
    this.emailService.sendTeamInvitationEmail({
      to: participant.email,
      invitedFirstName: participant.firstName,
      inviterName,
      teamName: team.name,
      message: dto.message,
    }).catch((err) => this.logger.warn(`Failed to send invitation email to participant: ${err.message}`));

    // Send confirmation email to the inviter
    if (inviter) {
      const invitedName = `${participant.firstName} ${participant.lastName}`;
      this.emailService.sendTeamInvitationConfirmation({
        to: inviter.email,
        inviterFirstName: inviter.firstName,
        invitedName,
        teamName: team.name,
      }).catch((err) => this.logger.warn(`Failed to send invitation confirmation email to inviter: ${err.message}`));
    }

    return savedInvitation;
  }

  async getParticipantInvitations(
    participantId: string,
    status?: InvitationStatus
  ): Promise<TeamInvitation[]> {
    const where: any = { participantId };
    if (status) {
      where.status = status;
    }

    return this.invitationRepository.find({
      where,
      relations: ["team", "team.members", "team.members.participant", "inviter"],
      order: { invitedAt: "DESC" },
    });
  }

  async getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
    return this.invitationRepository.find({
      where: { teamId },
      relations: ["participant", "inviter"],
      order: { invitedAt: "DESC" },
    });
  }

  @Transactional()
  async acceptInvitation(invitationId: string): Promise<Team> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ["team", "team.members", "participant"],
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (!invitation.canRespond()) {
      if (invitation.isExpired()) {
        throw new BadRequestException("Invitation has expired");
      }
      throw new BadRequestException("Invitation cannot be accepted");
    }

    // Check if participant is already in a team
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId: invitation.participantId },
    });
    if (existingMembership) {
      throw new ConflictException("You are already in a team");
    }

    // Check team capacity
    const cohort = await this.cohortRepository.findOne({
      where: { id: invitation.team.cohortId },
    });
    if (invitation.team.members.filter(member => member.status === TeamMemberStatus.CONFIRMED).length >= Math.min(ATF_TEAM_MAX, cohort?.teamSizeMax || ATF_TEAM_MAX)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    const participant = await this.participantRepository.findOne({ where: { id: invitation.participantId, cohortId: invitation.team.cohortId } });
    if (!participant) throw new NotFoundException("Participant not found in this cohort");
    this.assertSameGroup(invitation.team, participant, cohort);

    await assertMemberAdmission(this.teamRepository.manager, invitation.teamId, invitation.participantId);

    // Accept invitation
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.respondedAt = new Date();
    await this.invitationRepository.save(invitation);

    // Add as team member (CONFIRMED since invitation was from team lead)
    const member = this.memberRepository.create({
      teamId: invitation.teamId,
      participantId: invitation.participantId,
      role: TeamRole.MEMBER,
      status: TeamMemberStatus.CONFIRMED,
      confirmedAt: new Date(),
      confirmedBy: invitation.invitedBy, // Team lead who sent the invitation
    });
    await this.memberRepository.save(member);
    await clearTeamRegistration(this.teamRepository.manager, invitation.teamId);

    // Update participant status
    await this.participantRepository.update(invitation.participantId, {
      status: ParticipantStatus.ASSIGNED,
    });

    // Cancel other pending invitations for this participant
    await this.invitationRepository.update(
      {
        participantId: invitation.participantId,
        status: InvitationStatus.PENDING,
        id: Not(invitationId),
      },
      { status: InvitationStatus.CANCELLED }
    );

    // Send push notification to team leader about accepted invitation
    const teamLead = invitation.team.members.find((m) => m.role === TeamRole.LEAD);
    if (teamLead) {
      const acceptingParticipant = invitation.participant;
      const participantName = acceptingParticipant 
        ? `${acceptingParticipant.firstName} ${acceptingParticipant.lastName}`
        : "Someone";

      this.oneSignalService.sendToExternalUserIds(
        [`participant:${teamLead.participantId}`],
        {
          title: "Invitation Accepted!",
          body: `${participantName} has joined your team "${invitation.team.name}"`,
          data: {
            type: "invitation_accepted",
            teamId: invitation.teamId,
            participantId: invitation.participantId,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send acceptance push: ${err.message}`));
    }

    return this.findOne(invitation.teamId);
  }

  async declineInvitation(invitationId: string): Promise<TeamInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ["team", "team.members", "participant"],
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (!invitation.canRespond()) {
      throw new BadRequestException("Invitation cannot be declined");
    }

    invitation.status = InvitationStatus.DECLINED;
    invitation.respondedAt = new Date();

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Send push notification to team leader about declined invitation
    const teamLead = invitation.team.members.find((m) => m.role === TeamRole.LEAD);
    if (teamLead) {
      const decliningParticipant = invitation.participant;
      const participantName = decliningParticipant 
        ? `${decliningParticipant.firstName} ${decliningParticipant.lastName}`
        : "Someone";

      this.oneSignalService.sendToExternalUserIds(
        [`participant:${teamLead.participantId}`],
        {
          title: "Invitation Declined",
          body: `${participantName} declined to join "${invitation.team.name}"`,
          data: {
            type: "invitation_declined",
            teamId: invitation.teamId,
            participantId: invitation.participantId,
          },
          url: "/participant/team",
        }
      ).catch((err) => this.logger.warn(`Failed to send decline push: ${err.message}`));
    }

    return savedInvitation;
  }

  async cancelInvitation(invitationId: string, cancelledBy: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ["team", "team.members"],
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    // Verify canceller is team lead or co-lead
    const cancellerMember = invitation.team.members.find(
      (m) => m.participantId === cancelledBy
    );
    if (!cancellerMember || ![TeamRole.LEAD, TeamRole.CO_LEAD].includes(cancellerMember.role)) {
      throw new ForbiddenException("Only team leads or co-leads can cancel invitations");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException("Can only cancel pending invitations");
    }

    invitation.status = InvitationStatus.CANCELLED;
    await this.invitationRepository.save(invitation);
  }

  // ============ Search ============

  async searchAvailableParticipants(
    cohortId: string,
    query: string,
    limit: number = 10,
    group?: string | null,
    requireMatchingConsent = false
  ): Promise<Participant[]> {
    // Get participants who are not in any team
    const memberedParticipantIds = await this.memberRepository
      .createQueryBuilder("member")
      .select("member.participantId")
      .getMany();

    const excludeIds = memberedParticipantIds.map((m) => m.participantId);

    const qb = this.participantRepository
      .createQueryBuilder("p")
      .where("p.cohortId = :cohortId", { cohortId })
      .andWhere("p.onboardingComplete = true")
      .andWhere("p.status IN (:...statuses)", {
        statuses: [ParticipantStatus.READY, ParticipantStatus.ONBOARDING],
      });

    if (requireMatchingConsent) {
      qb.innerJoinAndSelect("p.preference", "matchingPreference", "matchingPreference.matchingProfileConsent = :consent", { consent: true })
        .select(["p.id", "p.firstName", "p.lastName", "p.country", "p.institution", "p.skills", "p.interests", "p.group", "p.cohortId", "matchingPreference.id", "matchingPreference.preferredRole", "matchingPreference.firstChoiceSector", "matchingPreference.backupSector"]);
    }

    if (group === null) qb.andWhere("p.group IS NULL");
    else if (group !== undefined) qb.andWhere("p.group = :group", { group });

    if (excludeIds.length > 0) {
      qb.andWhere("p.id NOT IN (:...excludeIds)", { excludeIds });
    }

    if (query) {
      qb.andWhere(
        "(LOWER(p.firstName) LIKE :query OR LOWER(p.lastName) LIKE :query OR LOWER(p.email) LIKE :query)",
        { query: `%${query.toLowerCase()}%` }
      );
    }

    return qb.take(limit).getMany();
  }

  // ============ Statistics ============

  async getStatistics(cohortId?: string): Promise<TeamStatisticsDto> {
    const where = cohortId ? { cohortId } : {};

    const [
      total,
      forming,
      active,
      submitted,
      evaluated,
      disqualified,
      withBrief,
      withoutBrief,
    ] = await Promise.all([
      this.teamRepository.count({ where }),
      this.teamRepository.count({ where: { ...where, status: TeamStatus.FORMING } }),
      this.teamRepository.count({ where: { ...where, status: TeamStatus.ACTIVE } }),
      this.teamRepository.count({ where: { ...where, status: TeamStatus.SUBMITTED } }),
      this.teamRepository.count({ where: { ...where, status: TeamStatus.EVALUATED } }),
      this.teamRepository.count({ where: { ...where, status: TeamStatus.DISQUALIFIED } }),
      this.teamRepository.count({ where: { ...where, briefId: Not(IsNull()) } }),
      this.teamRepository.count({ where: { ...where, briefId: IsNull() } }),
    ]);

    // Calculate average members
    const avgResult = await this.teamRepository
      .createQueryBuilder("team")
      .leftJoin("team.members", "member")
      .select("AVG(CASE WHEN member.id IS NOT NULL THEN 1 ELSE 0 END)", "avg")
      .where(cohortId ? "team.cohortId = :cohortId" : "1=1", { cohortId })
      .getRawOne();

    const memberCounts = await this.memberRepository
      .createQueryBuilder("member")
      .leftJoin("member.team", "team")
      .select("team.id", "teamId")
      .addSelect("COUNT(*)", "count")
      .where(cohortId ? "team.cohortId = :cohortId" : "1=1", { cohortId })
      .groupBy("team.id")
      .getRawMany();

    const averageMembers =
      memberCounts.length > 0
        ? memberCounts.reduce((acc, t) => acc + parseInt(t.count), 0) / memberCounts.length
        : 0;

    return {
      total,
      forming,
      active,
      submitted,
      evaluated,
      disqualified,
      withBrief,
      withoutBrief,
      averageMembers: Math.round(averageMembers * 10) / 10,
    };
  }

  // ============ Helpers ============

  private generateInviteCode(): string {
    return uuidv4().split("-")[0].toUpperCase();
  }

  // ============ Team Chat Management ============

  /**
   * Create a chat channel for a new team
   */
  private async createTeamChatChannel(team: Team, creator: Participant): Promise<ChatChannel> {
    const channel = this.chatChannelRepository.create({
      name: `${team.name} Team Chat`,
      description: `Private chat channel for team ${team.name}`,
      type: ChannelType.TEAM,
      cohortId: team.cohortId,
      teamId: team.id,
      isPrivate: true,
      isArchived: false,
    });

    const savedChannel = await this.chatChannelRepository.save(channel);

    // Add creator as channel member and admin
    const channelMember = this.channelMemberRepository.create({
      channelId: savedChannel.id,
      memberId: creator.id,
      memberType: SenderType.PARTICIPANT,
      memberName: `${creator.firstName} ${creator.lastName}`,
      isAdmin: true,
    });

    await this.channelMemberRepository.save(channelMember);

    this.logger.log(`Created chat channel for team ${team.id}: ${savedChannel.id}`);
    return savedChannel;
  }

  /**
   * Add a participant to the team's chat channel
   */
  private async addMemberToTeamChat(teamId: string, participant: Participant): Promise<void> {
    const channel = await this.chatChannelRepository.findOne({
      where: { teamId, type: ChannelType.TEAM },
    });

    if (!channel) {
      this.logger.warn(`No chat channel found for team ${teamId}`);
      return;
    }

    // Check if already a member
    const existingMember = await this.channelMemberRepository.findOne({
      where: { channelId: channel.id, memberId: participant.id, memberType: SenderType.PARTICIPANT },
    });

    if (existingMember) {
      this.logger.log(`Participant ${participant.id} already in chat channel ${channel.id}`);
      return;
    }

    const channelMember = this.channelMemberRepository.create({
      channelId: channel.id,
      memberId: participant.id,
      memberType: SenderType.PARTICIPANT,
      memberName: `${participant.firstName} ${participant.lastName}`,
      isAdmin: false,
    });

    await this.channelMemberRepository.save(channelMember);
    this.logger.log(`Added participant ${participant.id} to team chat ${channel.id}`);
  }

  /**
   * Remove a participant from the team's chat channel
   */
  private async removeMemberFromTeamChat(teamId: string, participantId: string): Promise<void> {
    const channel = await this.chatChannelRepository.findOne({
      where: { teamId, type: ChannelType.TEAM },
    });

    if (!channel) {
      return;
    }

    await this.channelMemberRepository.delete({
      channelId: channel.id,
      memberId: participantId,
      memberType: SenderType.PARTICIPANT,
    });

    this.logger.log(`Removed participant ${participantId} from team chat ${channel.id}`);
    afterCommit(this, () => this.socketSessions?.removeChannelMember(channel.id, participantId, SenderType.PARTICIPANT));
  }

  /**
   * Archive the team's chat channel (when team is deleted)
   */
  private async archiveTeamChat(teamId: string): Promise<void> {
    await this.chatChannelRepository.update(
      { teamId, type: ChannelType.TEAM },
      { isArchived: true }
    );
    this.logger.log(`Archived chat channel for team ${teamId}`);
  }

  /**
   * Initialize chat channel for an existing team (for migration purposes)
   */
  async initializeTeamChat(teamId: string): Promise<{ channelCreated: boolean; membersAdded: number }> {
    const team = await this.findOne(teamId);

    // Check if channel already exists
    const existingChannel = await this.chatChannelRepository.findOne({
      where: { teamId, type: ChannelType.TEAM },
    });

    if (existingChannel) {
      return { channelCreated: false, membersAdded: 0 };
    }

    // Create channel
    const channel = this.chatChannelRepository.create({
      name: `${team.name} Team Chat`,
      description: `Private chat channel for team ${team.name}`,
      type: ChannelType.TEAM,
      cohortId: team.cohortId,
      teamId: team.id,
      isPrivate: true,
      isArchived: false,
    });

    const savedChannel = await this.chatChannelRepository.save(channel);

    // Add all current team members
    let membersAdded = 0;
    for (const member of team.members) {
      const channelMember = this.channelMemberRepository.create({
        channelId: savedChannel.id,
        memberId: member.participantId,
        memberType: SenderType.PARTICIPANT,
        memberName: `${member.participant.firstName} ${member.participant.lastName}`,
        isAdmin: member.role === TeamRole.LEAD,
      });

      await this.channelMemberRepository.save(channelMember);
      membersAdded++;
    }

    this.logger.log(`Initialized chat channel for team ${teamId} with ${membersAdded} members`);
    return { channelCreated: true, membersAdded };
  }

  /**
   * Get all scheduled mentor sessions for a team
   * Returns upcoming and past sessions with mentor details
   */
  async getTeamSessions(teamId: string): Promise<{
    upcoming: ScheduledSession[];
    past: ScheduledSession[];
  }> {
    // Verify team exists
    await this.findOne(teamId);

    const now = new Date();

    // Get all sessions for this team
    const sessions = await this.scheduledSessionRepository.find({
      where: { teamId },
      relations: ["mentor"],
      order: { scheduledAt: "ASC" },
    });

    // Split into upcoming and past
    const upcoming = sessions.filter(
      (s) => 
        new Date(s.scheduledAt) >= now && 
        ![ScheduledSessionStatus.CANCELLED, ScheduledSessionStatus.COMPLETED].includes(s.status)
    );

    const past = sessions.filter(
      (s) => 
        new Date(s.scheduledAt) < now || 
        [ScheduledSessionStatus.COMPLETED, ScheduledSessionStatus.CANCELLED].includes(s.status)
    ).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    return { upcoming, past };
  }
}
