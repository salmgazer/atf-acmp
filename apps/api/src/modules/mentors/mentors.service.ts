import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, In, IsNull, Not, Between, MoreThanOrEqual, LessThanOrEqual } from "typeorm";
import {
  Mentor,
  MentorStatus,
  MentorAssignment,
  MentorSession,
  ScheduledSession,
  ScheduledSessionStatus,
  MentorPayment,
  MentorPaymentStatus,
} from "@/database/entities/mentor.entity";
import { Team, TeamStatus, TeamMember } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { User, Role } from "@/database/entities/user.entity";
import { ChatService } from "@/modules/chat/chat.service";
import { OneSignalService } from "@/modules/notifications/onesignal.service";
import {
  CreateMentorDto,
  UpdateMentorDto,
  MentorQueryDto,
  PaginatedMentorsDto,
  BulkImportMentorDto,
  BulkImportResultDto,
  AssignMentorDto,
  UnassignMentorDto,
  CreateSessionDto,
  UpdateSessionDto,
  SessionQueryDto,
  MentorStatisticsDto,
  MentorCapacityDto,
} from "./dto/mentor.dto";

@Injectable()
export class MentorsService {
  private readonly logger = new Logger(MentorsService.name);

  constructor(
    @InjectRepository(Mentor)
    private readonly mentorRepository: Repository<Mentor>,
    @InjectRepository(MentorAssignment)
    private readonly assignmentRepository: Repository<MentorAssignment>,
    @InjectRepository(MentorSession)
    private readonly sessionRepository: Repository<MentorSession>,
    @InjectRepository(ScheduledSession)
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,
    @InjectRepository(MentorPayment)
    private readonly paymentRepository: Repository<MentorPayment>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly oneSignalService: OneSignalService,
  ) {}

  // ============ Mentor CRUD ============

  /**
   * Sync mentor users - creates User records for mentors who don't have them
   * This is useful for existing mentors imported before the User sync was added
   */
  async syncMentorUsers(cohortId?: string): Promise<{ created: number; skipped: number }> {
    const where = cohortId ? { cohortId } : {};
    const mentors = await this.mentorRepository.find({ where });

    let created = 0;
    let skipped = 0;

    for (const mentor of mentors) {
      const existingUser = await this.userRepository.findOne({
        where: { email: mentor.email },
      });

      if (existingUser) {
        skipped++;
        continue;
      }

      const user = this.userRepository.create({
        email: mentor.email,
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        role: Role.MENTOR,
        isActive: true,
      });
      await this.userRepository.save(user);
      created++;
      this.logger.log(`Created user record for existing mentor: ${mentor.email}`);
    }

    return { created, skipped };
  }

  async create(dto: CreateMentorDto): Promise<Mentor> {
    const cohort = await this.cohortRepository.findOne({
      where: { id: dto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const existing = await this.mentorRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException("Mentor with this email already exists");
    }

    // Check if user with this email exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    let user: User;
    if (existingUser) {
      // Update existing user to mentor role if not already
      if (existingUser.role !== Role.MENTOR) {
        this.logger.warn(`User ${existingUser.id} already exists with role ${existingUser.role}, keeping existing role`);
      }
      user = existingUser;
    } else {
      // Create user record for mentor (for magic link login)
      user = this.userRepository.create({
        email: dto.email.toLowerCase(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: Role.MENTOR,
        isActive: true,
      });
      await this.userRepository.save(user);
      this.logger.log(`Created user record for mentor: ${user.email}`);
    }

    const mentor = this.mentorRepository.create({
      ...dto,
      email: dto.email.toLowerCase(),
      expertise: dto.expertise || [],
      verticalScope: dto.verticalScope || [],
      maxTeams: dto.maxTeams || 3,
    });

    return this.mentorRepository.save(mentor);
  }

  async findAll(query: MentorQueryDto): Promise<PaginatedMentorsDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.mentorRepository
      .createQueryBuilder("mentor")
      .leftJoinAndSelect("mentor.assignments", "assignment", "assignment.is_active = true")
      .leftJoinAndSelect("assignment.team", "team")
      .leftJoinAndSelect("mentor.cohort", "cohort");

    if (query.cohortId) {
      qb.andWhere("mentor.cohortId = :cohortId", { cohortId: query.cohortId });
    }

    if (query.status) {
      qb.andWhere("mentor.status = :status", { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        "(LOWER(mentor.firstName) LIKE :search OR LOWER(mentor.lastName) LIKE :search OR LOWER(mentor.email) LIKE :search OR LOWER(mentor.company) LIKE :search)",
        { search: `%${query.search.toLowerCase()}%` }
      );
    }

    if (query.verticalId) {
      qb.andWhere("mentor.vertical_scope @> :verticalId", {
        verticalId: JSON.stringify([query.verticalId]),
      });
    }

    if (query.hasCapacity !== undefined) {
      // Subquery to count active assignments
      const subQuery = qb
        .subQuery()
        .select("COUNT(*)")
        .from(MentorAssignment, "ma")
        .where("ma.mentor_id = mentor.id")
        .andWhere("ma.is_active = true")
        .getQuery();

      if (query.hasCapacity) {
        qb.andWhere(`(${subQuery}) < mentor.max_teams`);
      } else {
        qb.andWhere(`(${subQuery}) >= mentor.max_teams`);
      }
    }

    qb.orderBy("mentor.lastName", "ASC")
      .addOrderBy("mentor.firstName", "ASC")
      .skip(skip)
      .take(limit);

    const [mentors, total] = await qb.getManyAndCount();

    // Fetch session stats and earnings for all mentors
    const mentorIds = mentors.map(m => m.id);
    
    // Early return if no mentors - avoid empty IN clause SQL error
    if (mentorIds.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }
    
    // Get confirmed session counts (confirmed by mentor)
    const confirmedSessionCounts = await this.scheduledSessionRepository
      .createQueryBuilder("session")
      .select("session.mentorId", "mentorId")
      .addSelect("COUNT(*)", "count")
      .where("session.mentorId IN (:...mentorIds)", { mentorIds })
      .andWhere("session.confirmedByMentor = true")
      .andWhere("session.status NOT IN (:...excludedStatuses)", { 
        excludedStatuses: [ScheduledSessionStatus.CANCELLED, ScheduledSessionStatus.DECLINED] 
      })
      .groupBy("session.mentorId")
      .getRawMany();

    // Get completed session counts
    const completedSessionCounts = await this.scheduledSessionRepository
      .createQueryBuilder("session")
      .select("session.mentorId", "mentorId")
      .addSelect("COUNT(*)", "count")
      .where("session.mentorId IN (:...mentorIds)", { mentorIds })
      .andWhere("session.status = :status", { status: ScheduledSessionStatus.COMPLETED })
      .groupBy("session.mentorId")
      .getRawMany();

    // Get total paid amounts per mentor
    const paidAmounts = await this.paymentRepository
      .createQueryBuilder("payment")
      .select("payment.mentorId", "mentorId")
      .addSelect("COALESCE(SUM(payment.amount), 0)", "totalPaid")
      .where("payment.mentorId IN (:...mentorIds)", { mentorIds })
      .andWhere("payment.status = :status", { status: MentorPaymentStatus.COMPLETED })
      .groupBy("payment.mentorId")
      .getRawMany();

    // Create lookup maps
    const confirmedMap = new Map(confirmedSessionCounts.map(r => [r.mentorId, parseInt(r.count)]));
    const completedMap = new Map(completedSessionCounts.map(r => [r.mentorId, parseInt(r.count)]));
    const paidMap = new Map(paidAmounts.map(r => [r.mentorId, parseFloat(r.totalPaid)]));

    // Enhance mentor data with stats
    const data = mentors.map(mentor => {
      const confirmedSessions = confirmedMap.get(mentor.id) || 0;
      const completedSessions = completedMap.get(mentor.id) || 0;
      const sessionRate = mentor.sessionRateOverride !== null && mentor.sessionRateOverride !== undefined
        ? Number(mentor.sessionRateOverride)
        : (mentor.cohort?.sessionRate ? Number(mentor.cohort.sessionRate) : 0);
      const totalEarned = completedSessions * sessionRate;
      const totalPaid = paidMap.get(mentor.id) || 0;
      const unpaidAmount = totalEarned - totalPaid;

      return {
        ...mentor,
        confirmedSessions,
        completedSessions,
        sessionRate,
        totalEarned,
        totalPaid,
        unpaidAmount,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Mentor> {
    const mentor = await this.mentorRepository.findOne({
      where: { id },
      relations: [
        "assignments",
        "assignments.team",
        "assignments.team.members",
        "assignments.team.brief",
        "cohort",
      ],
    });

    if (!mentor) {
      throw new NotFoundException("Mentor not found");
    }

    return mentor;
  }

  async findByEmail(email: string): Promise<Mentor | null> {
    return this.mentorRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: ["assignments", "cohort"],
    });
  }

  async findByFirebaseUid(firebaseUid: string): Promise<Mentor | null> {
    return this.mentorRepository.findOne({
      where: { firebaseUid },
      relations: ["assignments", "cohort"],
    });
  }

  async update(id: string, dto: UpdateMentorDto): Promise<Mentor> {
    const mentor = await this.findOne(id);
    Object.assign(mentor, dto);
    await this.mentorRepository.save(mentor);
    return this.findOne(id);
  }

  async updateFirebaseUid(id: string, firebaseUid: string): Promise<Mentor> {
    const mentor = await this.findOne(id);
    mentor.firebaseUid = firebaseUid;
    if (mentor.status === MentorStatus.IMPORTED) {
      mentor.status = MentorStatus.ACTIVE;
    }
    return this.mentorRepository.save(mentor);
  }

  async delete(id: string): Promise<void> {
    const mentor = await this.findOne(id);
    await this.mentorRepository.softRemove(mentor);
  }

  // ============ Bulk Import ============

  async bulkImport(
    cohortId: string,
    mentors: BulkImportMentorDto[]
  ): Promise<BulkImportResultDto> {
    const cohort = await this.cohortRepository.findOne({
      where: { id: cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const result: BulkImportResultDto = {
      success: 0,
      failed: 0,
      errors: [],
      imported: [],
    };

    for (let i = 0; i < mentors.length; i++) {
      const row = mentors[i];
      const rowNumber = i + 2; // Account for header row

      try {
        // Validate required fields
        if (!row.email || !row.firstName || !row.lastName) {
          throw new Error("Missing required fields: email, firstName, or lastName");
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.email)) {
          throw new Error("Invalid email format");
        }

        // Check for existing mentor
        const existing = await this.mentorRepository.findOne({
          where: { email: row.email.toLowerCase() },
        });

        if (existing) {
          throw new Error("Mentor with this email already exists");
        }

        // Check if user with this email exists
        const existingUser = await this.userRepository.findOne({
          where: { email: row.email.toLowerCase() },
        });

        if (!existingUser) {
          // Create user record for mentor (for magic link login)
          const user = this.userRepository.create({
            email: row.email.toLowerCase(),
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            role: Role.MENTOR,
            isActive: true,
          });
          await this.userRepository.save(user);
          this.logger.log(`Created user record for imported mentor: ${user.email}`);
        }

        // Create mentor
        const mentor = this.mentorRepository.create({
          email: row.email.toLowerCase(),
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          phone: row.phone?.trim(),
          company: row.company?.trim(),
          title: row.title?.trim(),
          expertise: row.expertise || [],
          maxTeams: row.maxTeams || 3,
          cohortId,
          status: MentorStatus.IMPORTED,
        });

        await this.mentorRepository.save(mentor);
        result.success++;
        result.imported.push(mentor.id);
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          email: row.email,
          error: error.message,
        });
      }
    }

    return result;
  }

  // ============ Assignments ============

  async assignToTeam(mentorId: string, dto: AssignMentorDto, assignedBy?: string): Promise<MentorAssignment> {
    const mentor = await this.findOne(mentorId);

    // Check capacity
    const activeAssignments = mentor.assignments?.filter((a) => a.isActive) || [];
    if (activeAssignments.length >= mentor.maxTeams) {
      throw new BadRequestException("Mentor has reached maximum team capacity");
    }

    // Verify team exists
    const team = await this.teamRepository.findOne({
      where: { id: dto.teamId },
    });
    if (!team) {
      throw new NotFoundException("Team not found");
    }

    // Check if team already has a mentor
    const existingAssignment = await this.assignmentRepository.findOne({
      where: { teamId: dto.teamId, isActive: true },
    });
    if (existingAssignment) {
      throw new ConflictException("Team already has an assigned mentor");
    }

    // Check vertical scope if mentor has restrictions
    if (mentor.verticalScope.length > 0 && team.briefId) {
      const brief = await this.teamRepository
        .createQueryBuilder("team")
        .leftJoinAndSelect("team.brief", "brief")
        .where("team.id = :teamId", { teamId: dto.teamId })
        .getOne();

      if (brief?.brief?.verticalId && !mentor.verticalScope.includes(brief.brief.verticalId)) {
        throw new BadRequestException(
          "Mentor's vertical scope does not match team's brief vertical"
        );
      }
    }

    // Create assignment
    const assignment = this.assignmentRepository.create({
      mentorId,
      teamId: dto.teamId,
      assignedBy,
      notes: dto.notes,
    });

    await this.assignmentRepository.save(assignment);

    // Update team's mentor reference
    await this.teamRepository.update(dto.teamId, { mentorId });

    // Add mentor to team's mentor chat channel
    try {
      await this.chatService.addMentorToTeamChannel(
        dto.teamId,
        mentor.id,
        `${mentor.firstName} ${mentor.lastName}`,
        mentor.profileImageUrl
      );
      this.logger.log(`Added mentor ${mentor.email} to team ${team.name} chat channel`);
    } catch (error) {
      this.logger.warn(`Failed to add mentor to chat channel: ${error}`);
      // Don't fail the assignment if chat channel fails
    }

    const savedAssignment = await this.assignmentRepository.findOne({
      where: { id: assignment.id },
      relations: ["mentor", "team"],
    });
    
    if (!savedAssignment) {
      throw new NotFoundException("Assignment not found after save");
    }

    // Send push notifications to team members about mentor assignment
    this.notifyTeamOfMentorAssignment(dto.teamId, mentor, team.name)
      .catch((err) => this.logger.warn(`Failed to send mentor assignment push: ${err.message}`));
    
    return savedAssignment;
  }

  /**
   * Send push notification to team members when a mentor is assigned
   */
  private async notifyTeamOfMentorAssignment(
    teamId: string,
    mentor: Mentor,
    teamName: string
  ): Promise<void> {
    // Get all team members
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId },
    });

    if (teamMembers.length === 0) return;

    const participantIds = teamMembers.map((m) => `participant:${m.participantId}`);
    const mentorName = `${mentor.firstName} ${mentor.lastName}`;

    await this.oneSignalService.sendToExternalUserIds(participantIds, {
      title: "Mentor Assigned!",
      body: `${mentorName} has been assigned as your team's mentor`,
      data: {
        type: "mentor_assigned",
        teamId,
        mentorId: mentor.id,
      },
      url: "/app/team",
    });

    // Also notify the mentor
    await this.oneSignalService.sendToExternalUserIds([`mentor:${mentor.id}`], {
      title: "New Team Assignment",
      body: `You have been assigned to mentor team "${teamName}"`,
      data: {
        type: "team_assigned",
        teamId,
      },
      url: "/mentor/teams",
    });
  }

  async unassignFromTeam(mentorId: string, dto: UnassignMentorDto): Promise<void> {
    const assignment = await this.assignmentRepository.findOne({
      where: { mentorId, teamId: dto.teamId, isActive: true },
    });

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    assignment.isActive = false;
    assignment.unassignedAt = new Date();
    assignment.unassignReason = dto.reason;

    await this.assignmentRepository.save(assignment);

    // Clear team's mentor reference
    await this.teamRepository.update(dto.teamId, { mentorId: null } as any);

    // Remove mentor from team's mentor chat channel
    try {
      await this.chatService.removeMentorFromTeamChannel(dto.teamId, mentorId);
      this.logger.log(`Removed mentor ${mentorId} from team ${dto.teamId} chat channel`);
    } catch (error) {
      this.logger.warn(`Failed to remove mentor from chat channel: ${error}`);
      // Don't fail the unassignment if chat channel fails
    }
  }

  async getMentorTeams(mentorId: string): Promise<Team[]> {
    // Get teams through scheduled/booked sessions (the new connection method)
    // A team is connected to a mentor when they have booked sessions together
    const scheduledSessions = await this.scheduledSessionRepository.find({
      where: { mentorId },
      relations: [
        "team",
        "team.members",
        "team.members.participant",
        "team.brief",
        "team.brief.organization",
      ],
    });

    // Get unique teams from scheduled sessions
    const teamMap = new Map<string, Team>();
    for (const session of scheduledSessions) {
      if (session.team && !teamMap.has(session.team.id)) {
        teamMap.set(session.team.id, session.team);
      }
    }

    return Array.from(teamMap.values());
  }

  async getTeamMentor(teamId: string): Promise<Mentor | null> {
    // Get mentor through scheduled sessions (the new connection method)
    // Returns the mentor from the most recent booked session with this team
    const session = await this.scheduledSessionRepository.findOne({
      where: { teamId },
      relations: ["mentor"],
      order: { scheduledAt: "DESC" },
    });

    return session?.mentor || null;
  }

  // ============ Sessions ============

  async createSession(mentorId: string, dto: CreateSessionDto): Promise<MentorSession> {
    // Verify the team exists
    const team = await this.teamRepository.findOne({
      where: { id: dto.teamId },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    const session = this.sessionRepository.create({
      mentorId,
      teamId: dto.teamId,
      sessionDate: new Date(dto.sessionDate),
      durationMinutes: dto.durationMinutes,
      notes: dto.notes,
      topicsDiscussed: dto.topicsDiscussed || [],
      actionItems: dto.actionItems || [],
      teamProgressNotes: dto.teamProgressNotes,
      nextSessionGoals: dto.nextSessionGoals,
      sessionType: dto.sessionType || "regular",
    });

    return this.sessionRepository.save(session);
  }

  async updateSession(sessionId: string, dto: UpdateSessionDto): Promise<MentorSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (dto.sessionDate) {
      session.sessionDate = new Date(dto.sessionDate);
    }
    Object.assign(session, {
      ...dto,
      sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : session.sessionDate,
    });

    return this.sessionRepository.save(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    await this.sessionRepository.softRemove(session);
  }

  async getSessions(query: SessionQueryDto): Promise<{ data: MentorSession[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.sessionRepository
      .createQueryBuilder("session")
      .leftJoinAndSelect("session.mentor", "mentor")
      .leftJoinAndSelect("session.team", "team");

    if (query.teamId) {
      qb.andWhere("session.teamId = :teamId", { teamId: query.teamId });
    }

    if (query.mentorId) {
      qb.andWhere("session.mentorId = :mentorId", { mentorId: query.mentorId });
    }

    if (query.startDate) {
      qb.andWhere("session.sessionDate >= :startDate", {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere("session.sessionDate <= :endDate", {
        endDate: new Date(query.endDate),
      });
    }

    qb.orderBy("session.sessionDate", "DESC").skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total };
  }

  async getMentorSessions(mentorId: string, teamId?: string): Promise<MentorSession[]> {
    const where: any = { mentorId };
    if (teamId) {
      where.teamId = teamId;
    }

    return this.sessionRepository.find({
      where,
      relations: ["team"],
      order: { sessionDate: "DESC" },
    });
  }

  // ============ Statistics ============

  async getStatistics(cohortId?: string): Promise<MentorStatisticsDto> {
    const where = cohortId ? { cohortId } : {};

    const [total, active, inactive, imported] = await Promise.all([
      this.mentorRepository.count({ where }),
      this.mentorRepository.count({ where: { ...where, status: MentorStatus.ACTIVE } }),
      this.mentorRepository.count({ where: { ...where, status: MentorStatus.INACTIVE } }),
      this.mentorRepository.count({ where: { ...where, status: MentorStatus.IMPORTED } }),
    ]);

    // Calculate capacity stats
    const mentors = await this.mentorRepository.find({
      where,
      relations: ["assignments"],
    });

    let totalCapacity = 0;
    let assignedTeams = 0;

    for (const mentor of mentors) {
      totalCapacity += mentor.maxTeams;
      assignedTeams += mentor.assignments?.filter((a) => a.isActive)?.length || 0;
    }

    // Session stats
    const sessionStats = await this.sessionRepository
      .createQueryBuilder("session")
      .leftJoin("session.mentor", "mentor")
      .select("COUNT(*)", "totalSessions")
      .addSelect("SUM(session.duration_minutes)", "totalMinutes")
      .where(cohortId ? "mentor.cohort_id = :cohortId" : "1=1", { cohortId })
      .getRawOne();

    return {
      total,
      active,
      inactive,
      imported,
      totalCapacity,
      assignedTeams,
      availableSlots: totalCapacity - assignedTeams,
      averageTeamsPerMentor: total > 0 ? Math.round((assignedTeams / total) * 10) / 10 : 0,
      totalSessions: parseInt(sessionStats?.totalSessions || "0"),
      totalSessionHours: Math.round((parseInt(sessionStats?.totalMinutes || "0") / 60) * 10) / 10,
    };
  }

  async getCapacityList(cohortId?: string): Promise<MentorCapacityDto[]> {
    const mentors = await this.mentorRepository.find({
      where: cohortId ? { cohortId } : {},
      relations: ["assignments"],
      order: { lastName: "ASC", firstName: "ASC" },
    });

    return mentors.map((mentor) => {
      const assignedTeams = mentor.assignments?.filter((a) => a.isActive)?.length || 0;
      return {
        mentorId: mentor.id,
        mentorName: `${mentor.firstName} ${mentor.lastName}`,
        email: mentor.email,
        maxTeams: mentor.maxTeams,
        assignedTeams,
        availableSlots: Math.max(0, mentor.maxTeams - assignedTeams),
        verticalScope: mentor.verticalScope,
        status: mentor.status,
      };
    });
  }

  async suggestMentorsForTeam(teamId: string): Promise<Mentor[]> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ["brief"],
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    const qb = this.mentorRepository
      .createQueryBuilder("mentor")
      .leftJoinAndSelect("mentor.assignments", "assignment", "assignment.is_active = true")
      .where("mentor.cohortId = :cohortId", { cohortId: team.cohortId })
      .andWhere("mentor.status = :status", { status: MentorStatus.ACTIVE });

    // Filter by vertical if team has a brief with vertical
    if (team.brief?.verticalId) {
      qb.andWhere(
        "(mentor.vertical_scope = '[]'::jsonb OR mentor.vertical_scope @> :verticalId)",
        { verticalId: JSON.stringify([team.brief.verticalId]) }
      );
    }

    const mentors = await qb.getMany();

    // Filter by capacity and sort by available slots (descending)
    return mentors
      .filter((m) => {
        const assigned = m.assignments?.filter((a) => a.isActive)?.length || 0;
        return assigned < m.maxTeams;
      })
      .sort((a, b) => {
        const aAvailable = a.maxTeams - (a.assignments?.filter((x) => x.isActive)?.length || 0);
        const bAvailable = b.maxTeams - (b.assignments?.filter((x) => x.isActive)?.length || 0);
        return bAvailable - aAvailable;
      })
      .slice(0, 5);
  }
}
