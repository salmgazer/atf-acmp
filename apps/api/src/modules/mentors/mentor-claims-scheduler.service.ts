import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import {
  MentorClaim,
  MentorClaimStatus,
  ScheduledSession,
  ScheduledSessionStatus,
} from "@/database/entities/mentor.entity";
import { TeamMember } from "@/database/entities/team.entity";
import { GoogleCalendarService } from "@/modules/calendar/google-calendar.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { NotificationRecipientType } from "@/database/entities/notification.entity";

@Injectable()
export class MentorClaimsSchedulerService {
  private readonly logger = new Logger(MentorClaimsSchedulerService.name);

  // Days before session 1 must be booked (from claim date)
  private readonly CLAIM_EXPIRY_DAYS = 14;
  // Days of mentor non-response before auto-release
  private readonly MENTOR_NON_RESPONSE_DAYS = 10;
  // Hours before session to send reminder
  private readonly REMINDER_HOURS_BEFORE = 24;

  constructor(
    @InjectRepository(MentorClaim)
    private readonly claimRepository: Repository<MentorClaim>,
    @InjectRepository(ScheduledSession)
    private readonly sessionRepository: Repository<ScheduledSession>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    private readonly calendarService: GoogleCalendarService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Process expired claims (runs every hour)
   * Claims expire if session 1 is not booked within 14 days
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processExpiredClaims(): Promise<void> {
    this.logger.log("Processing expired mentor claims...");

    try {
      // Find active claims that have expired and have no sessions booked
      const expiredClaims = await this.claimRepository
        .createQueryBuilder("claim")
        .leftJoinAndSelect("claim.scheduledSessions", "session")
        .leftJoinAndSelect("claim.team", "team")
        .leftJoinAndSelect("claim.mentor", "mentor")
        .where("claim.status = :status", { status: MentorClaimStatus.ACTIVE })
        .andWhere("claim.expiresAt < :now", { now: new Date() })
        .andWhere("claim.sessionCount = 0")
        .getMany();

      this.logger.log(`Found ${expiredClaims.length} expired claims to process`);

      for (const claim of expiredClaims) {
        // Cancel any pending sessions (shouldn't be any if sessionCount is 0, but safety check)
        const pendingSessions = claim.scheduledSessions?.filter(
          (s) => s.status === ScheduledSessionStatus.SCHEDULED || s.status === ScheduledSessionStatus.CONFIRMED,
        ) || [];

        for (const session of pendingSessions) {
          if (session.googleEventId && this.calendarService.isReady()) {
            await this.calendarService.cancelEvent(session.googleEventId);
          }
          session.status = ScheduledSessionStatus.CANCELLED;
          session.cancelledAt = new Date();
          session.cancelReason = "Claim expired - session 1 not booked within 14 days";
          session.cancelledBy = "system";
          await this.sessionRepository.save(session);
        }

        // Mark claim as expired
        claim.status = MentorClaimStatus.EXPIRED;
        claim.releasedAt = new Date();
        claim.releaseReason = "expired";
        await this.claimRepository.save(claim);

        this.logger.log(`Claim ${claim.id} expired for team ${claim.teamId}`);

        // Notify team that their claim expired
        await this.notifyTeam(claim.teamId, {
          type: "mentor_claim_expired",
          title: "Mentor Claim Expired",
          body: `Your claim on mentor ${claim.mentor?.firstName} ${claim.mentor?.lastName} has expired because session 1 was not booked within 14 days. You can claim a new mentor.`,
          data: {
            claimId: claim.id,
            mentorId: claim.mentorId,
          },
        });
      }

      this.logger.log(`Processed ${expiredClaims.length} expired claims`);
    } catch (error) {
      this.logger.error(`Error processing expired claims: ${error}`);
    }
  }

  /**
   * Process mentor non-response (runs every hour)
   * Auto-release claims where mentor hasn't confirmed session within 10 days
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processMentorNonResponse(): Promise<void> {
    this.logger.log("Processing mentor non-response...");

    try {
      const nonResponseDeadline = new Date();
      nonResponseDeadline.setDate(nonResponseDeadline.getDate() - this.MENTOR_NON_RESPONSE_DAYS);

      // Find sessions that were booked but not confirmed within 10 days
      const unconfirmedSessions = await this.sessionRepository
        .createQueryBuilder("session")
        .leftJoinAndSelect("session.claim", "claim")
        .leftJoinAndSelect("session.mentor", "mentor")
        .leftJoinAndSelect("session.team", "team")
        .where("session.status = :status", { status: ScheduledSessionStatus.SCHEDULED })
        .andWhere("session.confirmedByMentor = false")
        .andWhere("session.bookedAt < :deadline", { deadline: nonResponseDeadline })
        .getMany();

      this.logger.log(`Found ${unconfirmedSessions.length} unconfirmed sessions (non-response)`);

      // Group sessions by claim to handle claim-level actions
      const claimIds = [...new Set(unconfirmedSessions.map((s) => s.claimId))];

      for (const claimId of claimIds) {
        const claim = await this.claimRepository.findOne({
          where: { id: claimId },
          relations: ["team", "mentor", "scheduledSessions"],
        });

        if (!claim || claim.status !== MentorClaimStatus.ACTIVE) {
          continue;
        }

        // Cancel all pending sessions for this claim
        const pendingSessions = claim.scheduledSessions?.filter(
          (s) =>
            (s.status === ScheduledSessionStatus.SCHEDULED || s.status === ScheduledSessionStatus.CONFIRMED) &&
            !s.confirmedByMentor,
        ) || [];

        for (const session of pendingSessions) {
          if (session.googleEventId && this.calendarService.isReady()) {
            await this.calendarService.cancelEvent(session.googleEventId);
          }
          session.status = ScheduledSessionStatus.CANCELLED;
          session.cancelledAt = new Date();
          session.cancelReason = "Mentor non-response - no confirmation within 10 days";
          session.cancelledBy = "system";
          await this.sessionRepository.save(session);
        }

        // Release the claim
        claim.status = MentorClaimStatus.RELEASED;
        claim.releasedAt = new Date();
        claim.releaseReason = "non_response";
        await this.claimRepository.save(claim);

        this.logger.log(`Claim ${claim.id} released due to mentor non-response`);

        // Notify team
        await this.notifyTeam(claim.teamId, {
          type: "mentor_non_response",
          title: "Mentor Session Not Confirmed",
          body: `Your mentor ${claim.mentor?.firstName} ${claim.mentor?.lastName} did not respond to your session request within 10 days. Your claim has been released and you can claim a new mentor.`,
          data: {
            claimId: claim.id,
            mentorId: claim.mentorId,
          },
        });

        // Notify mentor (optional - they may be inactive)
        await this.notifyMentor(claim.mentorId, {
          type: "mentor_claim_released",
          title: "Team Claim Released",
          body: `Your claim with team ${claim.team?.name} has been released due to non-response to session requests.`,
          data: {
            claimId: claim.id,
            teamId: claim.teamId,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error processing mentor non-response: ${error}`);
    }
  }

  /**
   * Send session reminders (runs every hour)
   * Remind participants 24 hours before scheduled sessions
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendSessionReminders(): Promise<void> {
    this.logger.log("Sending session reminders...");

    try {
      const now = new Date();
      const reminderWindowStart = new Date(now.getTime() + (this.REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000);
      const reminderWindowEnd = new Date(now.getTime() + this.REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

      // Find sessions in the reminder window that haven't been reminded
      const sessionsToRemind = await this.sessionRepository
        .createQueryBuilder("session")
        .leftJoinAndSelect("session.mentor", "mentor")
        .leftJoinAndSelect("session.team", "team")
        .where("session.status IN (:...statuses)", {
          statuses: [ScheduledSessionStatus.SCHEDULED, ScheduledSessionStatus.CONFIRMED],
        })
        .andWhere("session.scheduledAt > :start", { start: reminderWindowStart })
        .andWhere("session.scheduledAt <= :end", { end: reminderWindowEnd })
        .getMany();

      this.logger.log(`Found ${sessionsToRemind.length} sessions to remind`);

      for (const session of sessionsToRemind) {
        const meetLink = session.googleMeetLink ? `\n\nJoin: ${session.googleMeetLink}` : "";

        // Notify team
        await this.notifyTeam(session.teamId, {
          type: "session_reminder",
          title: "Mentor Session Tomorrow",
          body: `Reminder: You have a session with ${session.mentor?.firstName} ${session.mentor?.lastName} tomorrow at ${session.scheduledAt.toLocaleTimeString()}.${meetLink}`,
          data: {
            sessionId: session.id,
            scheduledAt: session.scheduledAt.toISOString(),
            googleMeetLink: session.googleMeetLink,
          },
        });

        // Notify mentor
        await this.notifyMentor(session.mentorId, {
          type: "session_reminder",
          title: "Mentor Session Tomorrow",
          body: `Reminder: You have a session with team ${session.team?.name} tomorrow at ${session.scheduledAt.toLocaleTimeString()}.${meetLink}`,
          data: {
            sessionId: session.id,
            scheduledAt: session.scheduledAt.toISOString(),
            googleMeetLink: session.googleMeetLink,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error sending session reminders: ${error}`);
    }
  }

  /**
   * Warn teams about upcoming claim expiry (runs daily)
   * Send warning 3 days before claim expires
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendClaimExpiryWarnings(): Promise<void> {
    this.logger.log("Sending claim expiry warnings...");

    try {
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 3); // 3 days from now

      const warningWindowStart = new Date(warningDate);
      warningWindowStart.setHours(0, 0, 0, 0);
      const warningWindowEnd = new Date(warningDate);
      warningWindowEnd.setHours(23, 59, 59, 999);

      // Find claims expiring in 3 days with no sessions booked
      const claimsExpiringSoon = await this.claimRepository
        .createQueryBuilder("claim")
        .leftJoinAndSelect("claim.mentor", "mentor")
        .leftJoinAndSelect("claim.team", "team")
        .where("claim.status = :status", { status: MentorClaimStatus.ACTIVE })
        .andWhere("claim.sessionCount = 0")
        .andWhere("claim.expiresAt >= :start", { start: warningWindowStart })
        .andWhere("claim.expiresAt <= :end", { end: warningWindowEnd })
        .getMany();

      this.logger.log(`Found ${claimsExpiringSoon.length} claims expiring soon`);

      for (const claim of claimsExpiringSoon) {
        await this.notifyTeam(claim.teamId, {
          type: "claim_expiry_warning",
          title: "Mentor Claim Expiring Soon",
          body: `Your claim on mentor ${claim.mentor?.firstName} ${claim.mentor?.lastName} will expire in 3 days if you don't book your first session. Book now to keep your mentor!`,
          data: {
            claimId: claim.id,
            mentorId: claim.mentorId,
            expiresAt: claim.expiresAt.toISOString(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error sending claim expiry warnings: ${error}`);
    }
  }

  /**
   * Manual trigger for processing expired claims (for admin use)
   */
  async manualProcessExpiredClaims(): Promise<{ processed: number }> {
    await this.processExpiredClaims();
    return { processed: 0 }; // Actual count is logged
  }

  /**
   * Manual trigger for processing non-response (for admin use)
   */
  async manualProcessNonResponse(): Promise<{ processed: number }> {
    await this.processMentorNonResponse();
    return { processed: 0 };
  }

  // ============ Helper Methods ============

  /**
   * Send notification to all members of a team
   */
  private async notifyTeam(
    teamId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      // Get all team members
      const members = await this.teamMemberRepository.find({
        where: { teamId },
      });

      for (const member of members) {
        await this.notificationsService.create({
          recipientId: member.participantId,
          recipientType: NotificationRecipientType.PARTICIPANT,
          type: notification.type as any,
          title: notification.title,
          body: notification.body,
          data: notification.data,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify team ${teamId}: ${error}`);
    }
  }

  /**
   * Send notification to a mentor
   */
  private async notifyMentor(
    mentorId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      await this.notificationsService.create({
        recipientId: mentorId,
        recipientType: NotificationRecipientType.MENTOR,
        type: notification.type as any,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
    } catch (error) {
      this.logger.error(`Failed to notify mentor ${mentorId}: ${error}`);
    }
  }
}
