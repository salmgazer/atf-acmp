import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, In, Not } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import {
  Team,
  TeamStatus,
  TeamRole,
  TeamMember,
  TeamInvitation,
  InvitationStatus,
} from "@/database/entities/team.entity";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Brief } from "@/database/entities/brief.entity";
import { ChatChannel, ChannelMember, ChannelType, SenderType } from "@/database/entities/chat.entity";
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
  ) {}

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

    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    // Create team
    const team = this.teamRepository.create({
      name: dto.name,
      description: dto.description,
      cohortId: dto.cohortId,
      inviteCode,
      status: TeamStatus.FORMING,
    });

    const savedTeam = await this.teamRepository.save(team);

    // Add creator as team lead
    const member = this.memberRepository.create({
      teamId: savedTeam.id,
      participantId: dto.creatorId,
      role: TeamRole.LEAD,
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

    if (query.status) {
      qb.andWhere("team.status = :status", { status: query.status });
    }

    if (query.briefId) {
      qb.andWhere("team.briefId = :briefId", { briefId: query.briefId });
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

    // Check team size
    if (team.members.length >= (cohort?.teamSizeMax || 5)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Verify participant exists and is in the same cohort
    const participant = await this.participantRepository.findOne({
      where: { id: participantId, cohortId: team.cohortId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this cohort");
    }

    // Check if participant is already in a team
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId },
    });
    if (existingMembership) {
      throw new ConflictException("You are already in a team");
    }

    // Add as member
    const member = this.memberRepository.create({
      teamId: team.id,
      participantId,
      role: TeamRole.MEMBER,
    });
    await this.memberRepository.save(member);

    // Update participant status
    await this.participantRepository.update(participantId, {
      status: ParticipantStatus.ASSIGNED,
    });

    return this.findOne(team.id);
  }

  async findOpenTeams(cohortId: string, search?: string): Promise<Team[]> {
    // Get cohort for max team size
    const cohort = await this.cohortRepository.findOne({
      where: { id: cohortId },
    });
    const maxTeamSize = cohort?.teamSizeMax || 5;

    const queryBuilder = this.teamRepository
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.members", "member")
      .leftJoinAndSelect("member.participant", "participant")
      .where("team.cohortId = :cohortId", { cohortId })
      .andWhere("team.status = :status", { status: TeamStatus.FORMING });

    if (search) {
      queryBuilder.andWhere(
        "(LOWER(team.name) LIKE LOWER(:search) OR LOWER(team.description) LIKE LOWER(:search))",
        { search: `%${search}%` }
      );
    }

    const teams = await queryBuilder.getMany();

    // Filter to only teams with available spots
    return teams.filter((team) => team.members.length < maxTeamSize);
  }

  async findParticipantTeam(participantId: string): Promise<Team | null> {
    const membership = await this.memberRepository.findOne({
      where: { participantId },
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
    team.status = status;
    await this.teamRepository.save(team);
    return team;
  }

  async assignBrief(id: string, briefId: string): Promise<Team> {
    const team = await this.findOne(id);
    const previousBriefId = team.briefId;

    const brief = await this.briefRepository.findOne({
      where: { id: briefId },
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
    const updateData: any = { briefId };
    if (team.status === TeamStatus.FORMING) {
      updateData.status = TeamStatus.ACTIVE;
    }
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

  async unassignBrief(id: string): Promise<Team> {
    const team = await this.findOne(id);

    if (!team.briefId) {
      throw new BadRequestException("Team does not have an assigned brief");
    }

    const previousBriefId = team.briefId;

    // Update the team to remove the brief assignment
    await this.teamRepository.update(id, { briefId: null as any });

    // Recalculate the brief's teamsCount
    await this.updateBriefTeamsCount(previousBriefId);

    return this.findOne(id);
  }

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

  async addMember(teamId: string, dto: AddMemberDto): Promise<TeamMember> {
    const team = await this.findOne(teamId);

    // Get cohort for team size limits
    const cohort = await this.cohortRepository.findOne({
      where: { id: team.cohortId },
    });

    // Check team size
    if (team.members.length >= (cohort?.teamSizeMax || 5)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Verify participant exists and is in the cohort
    const participant = await this.participantRepository.findOne({
      where: { id: dto.participantId, cohortId: team.cohortId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this cohort");
    }

    // Check if participant is already in a team
    const existingMembership = await this.memberRepository.findOne({
      where: { participantId: dto.participantId },
    });
    if (existingMembership) {
      throw new ConflictException("Participant is already in a team");
    }

    const member = this.memberRepository.create({
      teamId,
      participantId: dto.participantId,
      role: dto.role || TeamRole.MEMBER,
    });

    await this.memberRepository.save(member);

    // Update participant status
    await this.participantRepository.update(dto.participantId, {
      status: ParticipantStatus.ASSIGNED,
    });

    // Add member to team chat channel
    await this.addMemberToTeamChat(teamId, participant);

    return member;
  }

  async removeMember(teamId: string, participantId: string): Promise<void> {
    const team = await this.findOne(teamId);

    const member = team.members.find((m) => m.participantId === participantId);
    if (!member) {
      throw new NotFoundException("Member not found in team");
    }

    // Cannot remove lead if there are other members
    if (member.role === TeamRole.LEAD && team.members.length > 1) {
      throw new BadRequestException(
        "Cannot remove team lead. Transfer leadership first or remove all other members."
      );
    }

    await this.memberRepository.remove(member);

    // Update participant status back to READY
    await this.participantRepository.update(participantId, {
      status: ParticipantStatus.READY,
    });

    // Remove member from team chat channel
    await this.removeMemberFromTeamChat(teamId, participantId);

    // If team is empty, delete it (and archive the chat)
    if (team.members.length === 1) {
      await this.archiveTeamChat(teamId);
      await this.teamRepository.softRemove(team);
    }
  }

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
    if (team.members.length >= (cohort?.teamSizeMax || 5)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Verify participant exists
    const participant = await this.participantRepository.findOne({
      where: { id: dto.participantId, cohortId: team.cohortId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this cohort");
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

    const invitation = this.invitationRepository.create({
      teamId,
      participantId: dto.participantId,
      invitedBy: dto.invitedBy,
      message: dto.message,
      expiresAt,
    });

    return this.invitationRepository.save(invitation);
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

  async acceptInvitation(invitationId: string): Promise<Team> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ["team", "team.members"],
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
    if (invitation.team.members.length >= (cohort?.teamSizeMax || 5)) {
      throw new BadRequestException("Team has reached maximum capacity");
    }

    // Accept invitation
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.respondedAt = new Date();
    await this.invitationRepository.save(invitation);

    // Add as team member
    const member = this.memberRepository.create({
      teamId: invitation.teamId,
      participantId: invitation.participantId,
      role: TeamRole.MEMBER,
    });
    await this.memberRepository.save(member);

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

    return this.findOne(invitation.teamId);
  }

  async declineInvitation(invitationId: string): Promise<TeamInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (!invitation.canRespond()) {
      throw new BadRequestException("Invitation cannot be declined");
    }

    invitation.status = InvitationStatus.DECLINED;
    invitation.respondedAt = new Date();

    return this.invitationRepository.save(invitation);
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
    limit: number = 10
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
      this.teamRepository.count({ where: { ...where, briefId: Not(null as any) } }),
      this.teamRepository.count({ where: { ...where, briefId: null as any } }),
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
}
