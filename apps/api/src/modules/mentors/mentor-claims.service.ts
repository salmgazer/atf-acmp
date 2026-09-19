import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Like, ILike, Between } from "typeorm";
import {
  Mentor,
  MentorClaim,
  MentorClaimStatus,
  ScheduledSession,
  ScheduledSessionStatus,
  MentorCapability,
  MentorAvailability,
  MentorAvailabilityException,
  DayOfWeek,
} from "@/database/entities/mentor.entity";
import { Team } from "@/database/entities/team.entity";
import { Stage, Submission, SubmissionStatus } from "@/database/entities/stage.entity";
import { GoogleCalendarService } from "@/modules/calendar/google-calendar.service";
import { NotificationTriggersService } from "@/modules/notifications/notification-triggers.service";
import {
  BrowseMentorsQueryDto,
  BrowseMentorsResponseDto,
  MentorBrowseItemDto,
  ClaimMentorDto,
  ReleaseMentorClaimDto,
  SwapMentorDto,
  MentorClaimResponseDto,
  TeamClaimStatusDto,
  BookSessionDto,
  UpdateScheduledSessionDto,
  CancelSessionDto,
  CompleteSessionDto,
  RateSessionDto,
  ScheduledSessionResponseDto,
  ClaimEligibilityDto,
  ClaimSessionsQueryDto,
} from "./dto/mentor-claim.dto";

@Injectable()
export class MentorClaimsService {
  private readonly logger = new Logger(MentorClaimsService.name);

  // Claim expiry: 14 days for session 1 booking
  private readonly CLAIM_EXPIRY_DAYS = 14;
  // Default session duration: 45 minutes
  private readonly DEFAULT_SESSION_DURATION = 45;
  // Maximum sessions per claim
  private readonly MAX_SESSIONS_PER_CLAIM = 3;

  constructor(
    @InjectRepository(Mentor)
    private readonly mentorRepository: Repository<Mentor>,
    @InjectRepository(MentorClaim)
    private readonly claimRepository: Repository<MentorClaim>,
    @InjectRepository(ScheduledSession)
    private readonly sessionRepository: Repository<ScheduledSession>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(MentorAvailability)
    private readonly availabilityRepository: Repository<MentorAvailability>,
    @InjectRepository(MentorAvailabilityException)
    private readonly exceptionRepository: Repository<MentorAvailabilityException>,
    private readonly calendarService: GoogleCalendarService,
    private readonly notificationTriggers: NotificationTriggersService,
  ) {}

  // ============ Browse Mentors ============

  /**
   * Get mentor by email - helper for portal endpoints
   */
  async getMentorByEmail(email: string): Promise<Mentor> {
    const mentor = await this.mentorRepository.findOne({ where: { email } });
    if (!mentor) {
      throw new NotFoundException("Mentor profile not found");
    }
    return mentor;
  }

  /**
   * Browse available mentors by capability
   * Only shows mentors who have set up availability slots
   */
  async browseMentors(query: BrowseMentorsQueryDto): Promise<BrowseMentorsResponseDto> {
    const { capabilities, search, cohortId, page = 1, limit = 20 } = query;

    const qb = this.mentorRepository
      .createQueryBuilder("mentor")
      .leftJoinAndSelect("mentor.claims", "claim", "claim.status = :activeStatus", {
        activeStatus: MentorClaimStatus.ACTIVE,
      })
      // Only include mentors who have at least one availability slot
      .innerJoin("mentor.availabilitySlots", "availability")
      .where("mentor.status = :status", { status: "active" });

    if (cohortId) {
      qb.andWhere("mentor.cohortId = :cohortId", { cohortId });
    }

    // Filter by capabilities if provided
    if (capabilities && capabilities.length > 0) {
      // Match mentors that have ANY of the requested capabilities
      qb.andWhere("mentor.capabilities && :capabilities", {
        capabilities: JSON.stringify(capabilities),
      });
    }

    // Search by name or company
    if (search) {
      qb.andWhere(
        "(LOWER(mentor.firstName) LIKE LOWER(:search) OR LOWER(mentor.lastName) LIKE LOWER(:search) OR LOWER(mentor.company) LIKE LOWER(:search))",
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const mentors = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy("mentor.firstName", "ASC")
      .addOrderBy("mentor.lastName", "ASC")
      .getMany();

    const data: MentorBrowseItemDto[] = mentors.map((mentor) => {
      const activeClaimsCount = mentor.claims?.filter(
        (c) => c.status === MentorClaimStatus.ACTIVE,
      ).length || 0;
      const availableSlots = Math.max(0, mentor.maxClaims - activeClaimsCount);

      return {
        id: mentor.id,
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        company: mentor.company,
        title: mentor.title,
        bio: mentor.bio,
        profileImageUrl: mentor.profileImageUrl,
        expertise: mentor.expertise,
        capabilities: mentor.capabilities || [],
        linkedinUrl: mentor.linkedinUrl,
        availableClaimSlots: availableSlots,
        isAvailable: availableSlots > 0,
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

  // ============ Claim Operations ============

  /**
   * Check if a team is eligible to claim a mentor
   */
  async checkClaimEligibility(teamId: string, mentorId: string): Promise<ClaimEligibilityDto> {
    // Check if team exists
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException("Team not found");
    }

    // Check if mentor claim is unlocked for this team (stage completed & evaluated)
    const mentorClaimUnlocked = await this.isMentorClaimUnlockedForTeam(teamId, team.cohortId);
    if (!mentorClaimUnlocked.unlocked) {
      return {
        eligible: false,
        reason: mentorClaimUnlocked.reason || "Mentor claim not yet unlocked",
        teamHasActiveClaim: false,
        mentorHasCapacity: false,
        mentorClaimUnlocked: false,
        unlockingStageName: mentorClaimUnlocked.stageName,
      };
    }

    // Check if mentor exists and is active
    const mentor = await this.mentorRepository.findOne({
      where: { id: mentorId },
      relations: ["claims"],
    });
    if (!mentor) {
      throw new NotFoundException("Mentor not found");
    }

    // Check if team already has an active claim
    const existingTeamClaim = await this.claimRepository.findOne({
      where: {
        teamId,
        status: MentorClaimStatus.ACTIVE,
      },
      relations: ["mentor"],
    });

    if (existingTeamClaim) {
      return {
        eligible: false,
        reason: "Team already has an active mentor claim",
        existingClaim: this.mapClaimToResponse(existingTeamClaim),
        teamHasActiveClaim: true,
        mentorHasCapacity: false,
        mentorClaimUnlocked: true,
      };
    }

    // Check if mentor has capacity
    const activeClaimsCount = mentor.claims?.filter(
      (c) => c.status === MentorClaimStatus.ACTIVE,
    ).length || 0;
    const mentorHasCapacity = activeClaimsCount < mentor.maxClaims;

    if (!mentorHasCapacity) {
      return {
        eligible: false,
        reason: "Mentor has reached maximum active claims",
        teamHasActiveClaim: false,
        mentorHasCapacity: false,
        mentorClaimUnlocked: true,
      };
    }

    return {
      eligible: true,
      teamHasActiveClaim: false,
      mentorHasCapacity: true,
      mentorClaimUnlocked: true,
    };
  }

  /**
   * Check if mentor claim is unlocked for a team based on stage completion
   */
  async isMentorClaimUnlockedForTeam(
    teamId: string,
    cohortId: string,
  ): Promise<{ unlocked: boolean; reason?: string; stageName?: string }> {
    // Find the stage that unlocks mentor claim for this cohort
    const unlockingStage = await this.stageRepository.findOne({
      where: {
        cohortId,
        unlocksMentorClaim: true,
        isActive: true,
      },
      order: { number: "ASC" }, // Get the earliest unlocking stage
    });

    // If no stage is configured to unlock mentor claim, it's always available
    if (!unlockingStage) {
      return { unlocked: true };
    }

    // Check if the team has a submission for this stage that is evaluated or approved
    const submission = await this.submissionRepository.findOne({
      where: [
        {
          teamId,
          stageId: unlockingStage.id,
          status: SubmissionStatus.EVALUATED,
        },
        {
          teamId,
          stageId: unlockingStage.id,
          status: SubmissionStatus.APPROVED,
        },
      ],
    });

    if (!submission) {
      // Check if there's a pending submission
      const pendingSubmission = await this.submissionRepository.findOne({
        where: {
          teamId,
          stageId: unlockingStage.id,
          status: SubmissionStatus.PENDING_APPROVAL,
        },
      });
      
      if (pendingSubmission) {
        return {
          unlocked: false,
          reason: `Your submission for "${unlockingStage.name}" is pending approval`,
          stageName: unlockingStage.name,
        };
      }
      
      return {
        unlocked: false,
        reason: `Complete and get evaluated on "${unlockingStage.name}" to unlock mentor claiming`,
        stageName: unlockingStage.name,
      };
    }

    return { unlocked: true };
  }

  /**
   * Claim a mentor for a team
   */
  async claimMentor(
    teamId: string,
    dto: ClaimMentorDto,
    claimedByParticipantId: string,
  ): Promise<MentorClaimResponseDto> {
    const { mentorId, proposalSnapshot } = dto;

    // Verify eligibility
    const eligibility = await this.checkClaimEligibility(teamId, mentorId);
    if (!eligibility.eligible) {
      throw new ConflictException(eligibility.reason);
    }

    // Create the claim
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CLAIM_EXPIRY_DAYS);

    const claim = this.claimRepository.create({
      mentorId,
      teamId,
      claimedBy: claimedByParticipantId,
      expiresAt,
      status: MentorClaimStatus.ACTIVE,
      sessionCount: 0,
      swapUsed: false,
      proposalSnapshot,
    });

    const savedClaim = await this.claimRepository.save(claim);

    // Load the full claim with mentor
    const fullClaim = await this.claimRepository.findOne({
      where: { id: savedClaim.id },
      relations: ["mentor", "team"],
    });

    this.logger.log(`Team ${teamId} claimed mentor ${mentorId}`);

    // TODO: Send notification to mentor about new claim

    return this.mapClaimToResponse(fullClaim!);
  }

  /**
   * Get team's current claim status
   */
  async getTeamClaimStatus(teamId: string): Promise<TeamClaimStatusDto> {
    // Get team to find cohortId
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException("Team not found");
    }

    // Check if mentor claim is unlocked for this team
    const unlockStatus = await this.isMentorClaimUnlockedForTeam(teamId, team.cohortId);

    const claim = await this.claimRepository.findOne({
      where: {
        teamId,
        status: MentorClaimStatus.ACTIVE,
      },
      relations: ["mentor", "scheduledSessions"],
    });

    if (!claim) {
      return {
        hasClaim: false,
        canSwap: false,
        sessionsRemaining: 0,
        mentorClaimUnlocked: unlockStatus.unlocked,
        unlockingStageName: unlockStatus.stageName,
        unlockingStageReason: unlockStatus.reason,
      };
    }

    const sessionsRemaining = this.MAX_SESSIONS_PER_CLAIM - claim.sessionCount;

    // Calculate next session deadline
    let nextSessionDeadline: Date | undefined;
    if (claim.sessionCount === 0) {
      // Session 1 must be booked before claim expiry
      nextSessionDeadline = claim.expiresAt;
    }

    return {
      hasClaim: true,
      claim: this.mapClaimToResponse(claim),
      canSwap: !claim.swapUsed && claim.sessionCount >= 1,
      sessionsRemaining,
      nextSessionDeadline,
      mentorClaimUnlocked: true, // If they have a claim, it's unlocked
    };
  }

  /**
   * Release a mentor claim (by team)
   */
  async releaseClaim(
    teamId: string,
    dto: ReleaseMentorClaimDto,
  ): Promise<void> {
    const claim = await this.claimRepository.findOne({
      where: {
        teamId,
        status: MentorClaimStatus.ACTIVE,
      },
    });

    if (!claim) {
      throw new NotFoundException("No active claim found for this team");
    }

    // Cancel any scheduled sessions
    await this.cancelAllClaimSessions(claim.id, "Claim released by team");

    // Update claim status
    claim.status = MentorClaimStatus.RELEASED;
    claim.releasedAt = new Date();
    claim.releaseReason = dto.reason || "team_initiated";

    await this.claimRepository.save(claim);

    this.logger.log(`Team ${teamId} released claim ${claim.id}`);
  }

  /**
   * Swap to a different mentor (one-time swap allowed after session 1)
   */
  async swapMentor(
    teamId: string,
    dto: SwapMentorDto,
    participantId: string,
  ): Promise<MentorClaimResponseDto> {
    const { newMentorId, reason } = dto;

    // Get current claim
    const currentClaim = await this.claimRepository.findOne({
      where: {
        teamId,
        status: MentorClaimStatus.ACTIVE,
      },
    });

    if (!currentClaim) {
      throw new NotFoundException("No active claim found for this team");
    }

    // Check if swap is allowed
    if (currentClaim.swapUsed) {
      throw new BadRequestException("Team has already used their one-time mentor swap");
    }

    if (currentClaim.sessionCount < 1) {
      throw new BadRequestException("Must complete at least one session before swapping mentors");
    }

    // Check new mentor eligibility
    const newMentor = await this.mentorRepository.findOne({
      where: { id: newMentorId },
      relations: ["claims"],
    });

    if (!newMentor) {
      throw new NotFoundException("New mentor not found");
    }

    const activeClaimsCount = newMentor.claims?.filter(
      (c) => c.status === MentorClaimStatus.ACTIVE,
    ).length || 0;

    if (activeClaimsCount >= newMentor.maxClaims) {
      throw new ConflictException("New mentor has no available claim slots");
    }

    // Cancel any pending sessions on current claim
    await this.cancelAllClaimSessions(currentClaim.id, "Mentor swap");

    // Mark current claim as swapped
    currentClaim.status = MentorClaimStatus.SWAPPED;
    currentClaim.releasedAt = new Date();
    currentClaim.releaseReason = reason || "swap";
    await this.claimRepository.save(currentClaim);

    // Create new claim with remaining sessions
    const sessionsRemaining = this.MAX_SESSIONS_PER_CLAIM - currentClaim.sessionCount;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CLAIM_EXPIRY_DAYS);

    const newClaim = this.claimRepository.create({
      mentorId: newMentorId,
      teamId,
      claimedBy: participantId,
      expiresAt,
      status: MentorClaimStatus.ACTIVE,
      sessionCount: currentClaim.sessionCount, // Keep session count
      swapUsed: true, // Mark swap as used
      previousClaimId: currentClaim.id,
      proposalSnapshot: currentClaim.proposalSnapshot,
    });

    const savedClaim = await this.claimRepository.save(newClaim);

    const fullClaim = await this.claimRepository.findOne({
      where: { id: savedClaim.id },
      relations: ["mentor", "team"],
    });

    this.logger.log(`Team ${teamId} swapped from mentor ${currentClaim.mentorId} to ${newMentorId}`);

    return this.mapClaimToResponse(fullClaim!);
  }

  // ============ Session Operations ============

  /**
   * Book a session within a claim - validates against mentor's availability
   */
  async bookSession(
    claimId: string,
    dto: BookSessionDto,
    bookedByParticipantId: string,
  ): Promise<ScheduledSessionResponseDto> {
    const claim = await this.claimRepository.findOne({
      where: { id: claimId },
      relations: ["mentor", "team", "team.members", "team.members.participant", "scheduledSessions"],
    });

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    if (claim.status !== MentorClaimStatus.ACTIVE) {
      throw new BadRequestException("Cannot book session on inactive claim");
    }

    // Count existing sessions (scheduled, confirmed, or completed - exclude cancelled and declined)
    const bookedSessions = claim.scheduledSessions?.filter(
      (s) => s.status !== ScheduledSessionStatus.CANCELLED && s.status !== ScheduledSessionStatus.DECLINED,
    ).length || 0;

    if (bookedSessions >= this.MAX_SESSIONS_PER_CLAIM) {
      throw new BadRequestException("Maximum sessions already booked for this claim");
    }

    const sessionNumber = bookedSessions + 1;

    // Parse date and time from new DTO format
    const sessionDate = new Date(dto.date);
    const dayOfWeek = sessionDate.getDay() as DayOfWeek;
    const startTime = dto.startTime;

    // Validate the slot is within mentor's availability
    await this.validateSlotAvailability(claim.mentorId, dto.date, startTime, dayOfWeek);

    // Check slot is not already booked
    await this.checkSlotNotBooked(claim.mentorId, dto.date, startTime);

    // Get duration from mentor's availability settings
    const durationMinutes = await this.getSlotDuration(claim.mentorId, dayOfWeek, startTime);

    // Build scheduled datetime
    const [hour, minute] = startTime.split(":").map(Number);
    const scheduledAt = new Date(dto.date);
    scheduledAt.setHours(hour, minute, 0, 0);

    // Create session (calendar event will be created when mentor confirms)
    const session = this.sessionRepository.create({
      claimId,
      mentorId: claim.mentorId,
      teamId: claim.teamId,
      sessionNumber,
      scheduledAt,
      durationMinutes,
      question: dto.question,
      status: ScheduledSessionStatus.SCHEDULED,
      bookedBy: bookedByParticipantId,
    });

    const savedSession = await this.sessionRepository.save(session);

    this.logger.log(`Session ${sessionNumber} booked for claim ${claimId}`);

    // Notify mentor about the new session request
    await this.notificationTriggers.onMentorSessionRequested({
      mentorId: claim.mentorId,
      teamId: claim.teamId,
      teamName: claim.team.name,
      sessionId: savedSession.id,
      sessionDate: scheduledAt,
      question: dto.question,
    });

    return this.mapSessionToResponse(savedSession, claim.mentor, claim.team);
  }

  /**
   * Validate that the requested slot is within mentor's availability
   */
  private async validateSlotAvailability(
    mentorId: string,
    date: string,
    startTime: string,
    dayOfWeek: DayOfWeek,
  ): Promise<void> {
    // Check for exceptions first
    const exception = await this.exceptionRepository.findOne({
      where: { mentorId, date },
    });

    if (exception?.isUnavailable) {
      throw new BadRequestException("Mentor is not available on this date");
    }

    // If there are custom slots, validate against them
    if (exception?.customSlots && exception.customSlots.length > 0) {
      const slotMatch = exception.customSlots.some(
        (slot) => this.isTimeWithinWindow(startTime, slot.startTime, slot.endTime),
      );
      if (!slotMatch) {
        throw new BadRequestException("Selected time is not within mentor's available slots for this date");
      }
      return;
    }

    // Otherwise validate against weekly availability
    const weeklySlots = await this.availabilityRepository.find({
      where: { mentorId, dayOfWeek, isActive: true },
    });

    if (weeklySlots.length === 0) {
      throw new BadRequestException("Mentor has no availability set for this day of week");
    }

    const slotMatch = weeklySlots.some((slot) => {
      const slotStart = slot.startTime.substring(0, 5);
      const slotEnd = slot.endTime.substring(0, 5);
      return this.isTimeWithinWindow(startTime, slotStart, slotEnd);
    });

    if (!slotMatch) {
      throw new BadRequestException("Selected time is not within mentor's available time slots");
    }
  }

  /**
   * Check that the slot is not already booked
   */
  private async checkSlotNotBooked(
    mentorId: string,
    date: string,
    startTime: string,
  ): Promise<void> {
    const [hour, minute] = startTime.split(":").map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(hour, minute, 0, 0);

    // Check +/- 1 hour to catch any overlapping sessions
    const checkStart = new Date(slotStart);
    checkStart.setHours(checkStart.getHours() - 1);
    const checkEnd = new Date(slotStart);
    checkEnd.setHours(checkEnd.getHours() + 2);

    const existingSessions = await this.sessionRepository.find({
      where: {
        mentorId,
        scheduledAt: Between(checkStart, checkEnd),
        status: In([ScheduledSessionStatus.SCHEDULED, ScheduledSessionStatus.CONFIRMED]),
      },
    });

    // Check for overlap with exact time
    const conflict = existingSessions.some((session) => {
      const sessionStart = session.scheduledAt.getTime();
      const sessionEnd = sessionStart + session.durationMinutes * 60 * 1000;
      const requestedStart = slotStart.getTime();
      const requestedEnd = requestedStart + 45 * 60 * 1000; // Assume 45 min default
      return requestedStart < sessionEnd && requestedEnd > sessionStart;
    });

    if (conflict) {
      throw new ConflictException("This time slot is already booked");
    }
  }

  /**
   * Get the duration for a slot based on mentor's availability settings
   */
  private async getSlotDuration(
    mentorId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
  ): Promise<number> {
    const weeklySlot = await this.availabilityRepository.findOne({
      where: { mentorId, dayOfWeek, isActive: true },
    });
    return weeklySlot?.durationMinutes || this.DEFAULT_SESSION_DURATION;
  }

  /**
   * Check if a time falls within a time window
   */
  private isTimeWithinWindow(time: string, windowStart: string, windowEnd: string): boolean {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const timeMin = toMinutes(time);
    const startMin = toMinutes(windowStart);
    const endMin = toMinutes(windowEnd);
    return timeMin >= startMin && timeMin < endMin;
  }

  /**
   * Update a scheduled session
   */
  async updateSession(
    sessionId: string,
    dto: UpdateScheduledSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["mentor", "team", "claim"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status === ScheduledSessionStatus.COMPLETED) {
      throw new BadRequestException("Cannot update completed session");
    }

    if (session.status === ScheduledSessionStatus.CANCELLED) {
      throw new BadRequestException("Cannot update cancelled session");
    }

    // Update fields
    if (dto.scheduledAt) session.scheduledAt = new Date(dto.scheduledAt);
    if (dto.question) session.question = dto.question;
    if (dto.durationMinutes) session.durationMinutes = dto.durationMinutes;

    // Update Google Calendar event
    if (session.googleEventId && this.calendarService.isReady()) {
      try {
        await this.calendarService.updateEvent({
          eventId: session.googleEventId,
          calendarId: session.mentor.googleCalendarId || "primary",
          startTime: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          durationMinutes: dto.durationMinutes,
          description: dto.question
            ? `Session ${session.sessionNumber} of ${this.MAX_SESSIONS_PER_CLAIM}\n\nQuestion/Topic:\n${dto.question}`
            : undefined,
        });
      } catch (error) {
        this.logger.error(`Failed to update calendar event: ${error}`);
      }
    }

    const updatedSession = await this.sessionRepository.save(session);

    return this.mapSessionToResponse(updatedSession, session.mentor, session.team);
  }

  /**
   * Cancel a scheduled session
   */
  async cancelSession(
    sessionId: string,
    dto: CancelSessionDto,
    cancelledBy: "team" | "mentor",
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["mentor"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status === ScheduledSessionStatus.COMPLETED) {
      throw new BadRequestException("Cannot cancel completed session");
    }

    // Cancel Google Calendar event
    if (session.googleEventId && this.calendarService.isReady()) {
      await this.calendarService.cancelEvent(
        session.googleEventId,
        session.mentor.googleCalendarId || "primary",
      );
    }

    session.status = ScheduledSessionStatus.CANCELLED;
    session.cancelledAt = new Date();
    session.cancelReason = dto.reason;
    session.cancelledBy = cancelledBy;

    await this.sessionRepository.save(session);

    this.logger.log(`Session ${sessionId} cancelled by ${cancelledBy}`);
  }

  /**
   * Mark a session as completed (by mentor)
   */
  async completeSession(
    sessionId: string,
    dto: CompleteSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["mentor", "team", "claim"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status === ScheduledSessionStatus.COMPLETED) {
      throw new BadRequestException("Session already completed");
    }

    session.status = ScheduledSessionStatus.COMPLETED;
    session.completedAt = new Date();
    if (dto.notes) session.notes = dto.notes;
    if (dto.actionItems) session.actionItems = dto.actionItems;
    if (dto.mentorFeedback) session.mentorFeedback = dto.mentorFeedback;

    await this.sessionRepository.save(session);

    // Increment session count on claim
    const claim = session.claim;
    claim.sessionCount += 1;

    // Check if all sessions completed
    if (claim.sessionCount >= this.MAX_SESSIONS_PER_CLAIM) {
      claim.status = MentorClaimStatus.COMPLETED;
    }

    await this.claimRepository.save(claim);

    this.logger.log(`Session ${sessionId} completed. Claim session count: ${claim.sessionCount}`);

    return this.mapSessionToResponse(session, session.mentor, session.team);
  }

  /**
   * Rate a completed session (by team)
   */
  async rateSession(
    sessionId: string,
    dto: RateSessionDto,
  ): Promise<ScheduledSessionResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["mentor", "team"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status !== ScheduledSessionStatus.COMPLETED) {
      throw new BadRequestException("Can only rate completed sessions");
    }

    session.rating = dto.rating;
    if (dto.teamFeedback) session.teamFeedback = dto.teamFeedback;

    await this.sessionRepository.save(session);

    return this.mapSessionToResponse(session, session.mentor, session.team);
  }

  /**
   * Get sessions for a claim
   */
  async getClaimSessions(
    claimId: string,
    query?: ClaimSessionsQueryDto,
  ): Promise<ScheduledSessionResponseDto[]> {
    const qb = this.sessionRepository
      .createQueryBuilder("session")
      .leftJoinAndSelect("session.mentor", "mentor")
      .leftJoinAndSelect("session.team", "team")
      .where("session.claimId = :claimId", { claimId })
      .orderBy("session.sessionNumber", "ASC");

    if (query?.status) {
      qb.andWhere("session.status = :status", { status: query.status });
    }

    if (query?.startDate) {
      qb.andWhere("session.scheduledAt >= :startDate", { startDate: query.startDate });
    }

    if (query?.endDate) {
      qb.andWhere("session.scheduledAt <= :endDate", { endDate: query.endDate });
    }

    const sessions = await qb.getMany();

    return sessions.map((s) => this.mapSessionToResponse(s, s.mentor, s.team));
  }

  /**
   * Get all scheduled sessions for a mentor, optionally filtered by team
   */
  async getMentorScheduledSessions(
    mentorId: string,
    teamId?: string,
  ): Promise<ScheduledSessionResponseDto[]> {
    const qb = this.sessionRepository
      .createQueryBuilder("session")
      .leftJoinAndSelect("session.mentor", "mentor")
      .leftJoinAndSelect("session.team", "team")
      .where("session.mentorId = :mentorId", { mentorId })
      .orderBy("session.scheduledAt", "ASC");

    if (teamId) {
      qb.andWhere("session.teamId = :teamId", { teamId });
    }

    const sessions = await qb.getMany();

    return sessions.map((s) => this.mapSessionToResponse(s, s.mentor, s.team));
  }

  /**
   * Mentor confirms a session
   */
  async confirmSession(sessionId: string): Promise<ScheduledSessionResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["mentor", "team", "team.members", "team.members.participant", "claim"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status !== ScheduledSessionStatus.SCHEDULED) {
      throw new BadRequestException("Session cannot be confirmed in current status");
    }

    // Create Google Calendar event now that mentor has confirmed
    if (this.calendarService.isReady()) {
      try {
        // Collect attendee emails: mentor + all confirmed team members
        const teamMemberEmails = session.team.confirmedMembers
          ?.map((member) => member.participant?.email)
          .filter((email): email is string => !!email) || [];
        
        const attendees = [session.mentor.email, ...teamMemberEmails];

        const eventResult = await this.calendarService.createEvent({
          summary: `Mentor Session: ${session.team.name} + ${session.mentor.firstName} ${session.mentor.lastName}`,
          description: `Session ${session.sessionNumber} of ${this.MAX_SESSIONS_PER_CLAIM}\n\nQuestion/Topic:\n${session.question}`,
          startTime: session.scheduledAt,
          durationMinutes: session.durationMinutes,
          attendees,
          calendarId: session.mentor.googleCalendarId || "primary",
        });

        if (eventResult) {
          session.googleEventId = eventResult.eventId;
          session.googleCalendarLink = eventResult.htmlLink;
          session.googleMeetLink = eventResult.meetLink;
        }
      } catch (error) {
        this.logger.error(`Failed to create calendar event: ${error}`);
        // Continue - session can still be confirmed without calendar
      }
    }

    session.confirmedByMentor = true;
    session.confirmedAt = new Date();
    session.status = ScheduledSessionStatus.CONFIRMED;

    await this.sessionRepository.save(session);

    // Notify team members that session is confirmed
    const teamMemberIds = session.team.confirmedMembers.map((m) => m.participantId);
    if (teamMemberIds.length > 0) {
      await this.notificationTriggers.onMentorSessionConfirmed({
        teamMemberIds,
        teamId: session.teamId,
        teamName: session.team.name,
        mentorName: session.mentor.fullName,
        sessionId: session.id,
        sessionDate: session.scheduledAt,
        googleMeetLink: session.googleMeetLink,
      });
    }

    this.logger.log(`Session ${sessionId} confirmed by mentor`);

    return this.mapSessionToResponse(session, session.mentor, session.team);
  }

  /**
   * Mentor declines a session request
   */
  async declineSession(sessionId: string, reason?: string): Promise<ScheduledSessionResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["mentor", "team", "team.members", "team.members.participant"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status !== ScheduledSessionStatus.SCHEDULED) {
      throw new BadRequestException("Session cannot be declined in current status");
    }

    // Cancel Google Calendar event if exists
    if (session.googleEventId && this.calendarService.isReady()) {
      try {
        await this.calendarService.cancelEvent(
          session.googleEventId,
          session.mentor.googleCalendarId || "primary",
        );
      } catch (error) {
        this.logger.error(`Failed to cancel calendar event: ${error}`);
      }
    }

    session.status = ScheduledSessionStatus.DECLINED;
    session.declinedAt = new Date();
    session.declineReason = reason;

    await this.sessionRepository.save(session);

    // Notify team members that session was declined
    const teamMemberIds = session.team.confirmedMembers.map((m) => m.participantId);
    if (teamMemberIds.length > 0) {
      await this.notificationTriggers.onMentorSessionDeclined({
        teamMemberIds,
        teamId: session.teamId,
        teamName: session.team.name,
        mentorName: session.mentor.fullName,
        sessionId: session.id,
        sessionDate: session.scheduledAt,
        declineReason: reason,
      });
    }

    this.logger.log(`Session ${sessionId} declined by mentor`);

    return this.mapSessionToResponse(session, session.mentor, session.team);
  }

  // ============ Helper Methods ============

  private async cancelAllClaimSessions(claimId: string, reason: string): Promise<void> {
    const sessions = await this.sessionRepository.find({
      where: {
        claimId,
        status: In([ScheduledSessionStatus.SCHEDULED, ScheduledSessionStatus.CONFIRMED]),
      },
      relations: ["mentor"],
    });

    for (const session of sessions) {
      if (session.googleEventId && this.calendarService.isReady()) {
        await this.calendarService.cancelEvent(
          session.googleEventId,
          session.mentor.googleCalendarId || "primary",
        );
      }

      session.status = ScheduledSessionStatus.CANCELLED;
      session.cancelledAt = new Date();
      session.cancelReason = reason;
      session.cancelledBy = "system";

      await this.sessionRepository.save(session);
    }
  }

  private mapClaimToResponse(claim: MentorClaim): MentorClaimResponseDto {
    // Count booked sessions (scheduled, confirmed, completed - excludes cancelled, declined, no_show, rescheduled)
    const activeStatuses = [
      ScheduledSessionStatus.SCHEDULED,
      ScheduledSessionStatus.CONFIRMED,
      ScheduledSessionStatus.COMPLETED,
    ];
    const bookedSessionCount = claim.scheduledSessions?.filter(
      (s) => activeStatuses.includes(s.status)
    ).length || 0;

    return {
      id: claim.id,
      mentorId: claim.mentorId,
      teamId: claim.teamId,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
      status: claim.status,
      sessionCount: claim.sessionCount,
      bookedSessionCount,
      swapUsed: claim.swapUsed,
      mentor: claim.mentor
        ? {
            id: claim.mentor.id,
            firstName: claim.mentor.firstName,
            lastName: claim.mentor.lastName,
            email: claim.mentor.email,
            company: claim.mentor.company,
            title: claim.mentor.title,
            profileImageUrl: claim.mentor.profileImageUrl,
            capabilities: claim.mentor.capabilities || [],
          }
        : undefined,
    };
  }

  private mapSessionToResponse(
    session: ScheduledSession,
    mentor?: Mentor,
    team?: Team,
  ): ScheduledSessionResponseDto {
    return {
      id: session.id,
      claimId: session.claimId,
      mentorId: session.mentorId,
      teamId: session.teamId,
      sessionNumber: session.sessionNumber,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      question: session.question,
      status: session.status,
      googleEventId: session.googleEventId,
      googleCalendarLink: session.googleCalendarLink,
      googleMeetLink: session.googleMeetLink,
      confirmedByMentor: session.confirmedByMentor,
      confirmedAt: session.confirmedAt,
      declinedAt: session.declinedAt,
      declineReason: session.declineReason,
      completedAt: session.completedAt,
      notes: session.notes,
      actionItems: session.actionItems || [],
      mentorFeedback: session.mentorFeedback,
      teamFeedback: session.teamFeedback,
      rating: session.rating,
      mentor: mentor
        ? {
            id: mentor.id,
            firstName: mentor.firstName,
            lastName: mentor.lastName,
            email: mentor.email,
          }
        : undefined,
      team: team
        ? {
            id: team.id,
            name: team.name,
          }
        : undefined,
    };
  }

  /**
   * Get all scheduled sessions for staff calendar view
   */
  async getAllScheduledSessions(
    cohortId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ScheduledSessionResponseDto[]> {
    const qb = this.sessionRepository
      .createQueryBuilder("session")
      .leftJoinAndSelect("session.mentor", "mentor")
      .leftJoinAndSelect("session.team", "team")
      .orderBy("session.scheduledAt", "ASC");

    if (cohortId) {
      qb.andWhere("mentor.cohortId = :cohortId", { cohortId });
    }

    if (startDate) {
      qb.andWhere("session.scheduledAt >= :startDate", { startDate });
    }

    if (endDate) {
      qb.andWhere("session.scheduledAt <= :endDate", { endDate });
    }

    const sessions = await qb.getMany();

    return sessions.map((s) => this.mapSessionToResponse(s, s.mentor, s.team));
  }
}
