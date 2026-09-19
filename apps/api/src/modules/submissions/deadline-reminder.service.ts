import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, In, Not, LessThan, MoreThan } from "typeorm";
import { Stage, Submission, SubmissionStatus } from "@/database/entities/stage.entity";
import { Team, TeamMember, TeamStatus } from "@/database/entities/team.entity";
import { OneSignalService } from "@/modules/notifications/onesignal.service";

interface DeadlineReminderResult {
  stageId: string;
  stageName: string;
  deadline: Date;
  teamsNotified: number;
  participantsNotified: number;
}

@Injectable()
export class DeadlineReminderService {
  private readonly logger = new Logger(DeadlineReminderService.name);

  constructor(
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    private readonly oneSignalService: OneSignalService,
  ) {}

  /**
   * Send reminder notifications for stages with deadlines approaching
   * This should be called by a cron job (e.g., every hour)
   * 
   * @param hoursBeforeDeadline - Send reminder when deadline is this many hours away (default 24)
   */
  async sendDeadlineReminders(hoursBeforeDeadline: number = 24): Promise<DeadlineReminderResult[]> {
    const results: DeadlineReminderResult[] = [];

    // Find stages with deadlines in the next N hours
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + hoursBeforeDeadline * 60 * 60 * 1000);
    const reminderWindowStart = new Date(now.getTime() + (hoursBeforeDeadline - 1) * 60 * 60 * 1000);

    // Get active stages with deadlines in our window (to avoid sending reminders multiple times)
    const stages = await this.stageRepository.find({
      where: {
        isActive: true,
        deadline: Between(reminderWindowStart, reminderWindow),
      },
    });

    this.logger.log(`Found ${stages.length} stages with deadlines in ${hoursBeforeDeadline}h window`);

    for (const stage of stages) {
      const result = await this.sendReminderForStage(stage, hoursBeforeDeadline);
      results.push(result);
    }

    return results;
  }

  /**
   * Send reminder for a specific stage to teams that haven't submitted yet
   */
  private async sendReminderForStage(stage: Stage, hoursRemaining: number): Promise<DeadlineReminderResult> {
    // Get all teams in the cohort that haven't submitted for this stage
    const teamsWithSubmissions = await this.submissionRepository.find({
      where: {
        stageId: stage.id,
        status: In([SubmissionStatus.SUBMITTED, SubmissionStatus.LATE, SubmissionStatus.EVALUATED]),
      },
      select: ["teamId"],
    });

    const submittedTeamIds = teamsWithSubmissions.map((s) => s.teamId);

    // Get active teams that haven't submitted
    const teamsQuery = this.teamRepository
      .createQueryBuilder("team")
      .where("team.cohortId = :cohortId", { cohortId: stage.cohortId })
      .andWhere("team.status NOT IN (:...excludedStatuses)", {
        excludedStatuses: [TeamStatus.DISQUALIFIED],
      });

    if (submittedTeamIds.length > 0) {
      teamsQuery.andWhere("team.id NOT IN (:...submittedTeamIds)", { submittedTeamIds });
    }

    const teamsToNotify = await teamsQuery.getMany();

    if (teamsToNotify.length === 0) {
      this.logger.log(`No teams to notify for stage ${stage.name}`);
      return {
        stageId: stage.id,
        stageName: stage.name,
        deadline: stage.deadline,
        teamsNotified: 0,
        participantsNotified: 0,
      };
    }

    // Get all participants from these teams
    const teamIds = teamsToNotify.map((t) => t.id);
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId: In(teamIds) },
    });

    const participantIds = teamMembers.map((m) => `participant:${m.participantId}`);

    if (participantIds.length === 0) {
      return {
        stageId: stage.id,
        stageName: stage.name,
        deadline: stage.deadline,
        teamsNotified: teamsToNotify.length,
        participantsNotified: 0,
      };
    }

    // Format the deadline time
    const deadlineStr = this.formatDeadline(stage.deadline, hoursRemaining);

    // Send push notification
    const result = await this.oneSignalService.sendToExternalUserIds(participantIds, {
      title: `⏰ Submission Deadline: ${stage.name}`,
      body: `${deadlineStr}. Don't forget to submit your team's work!`,
      data: {
        type: "submission_deadline",
        stageId: stage.id,
        stageName: stage.name,
        deadline: stage.deadline.toISOString(),
      },
      url: "/app/submissions",
    });

    if (result.success) {
      this.logger.log(
        `Sent deadline reminder for stage "${stage.name}" to ${participantIds.length} participants`
      );
    } else {
      this.logger.warn(`Failed to send deadline reminder: ${result.errors?.join(", ")}`);
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      deadline: stage.deadline,
      teamsNotified: teamsToNotify.length,
      participantsNotified: participantIds.length,
    };
  }

  /**
   * Format deadline for notification message
   */
  private formatDeadline(deadline: Date, hoursRemaining: number): string {
    if (hoursRemaining <= 1) {
      return "Less than 1 hour remaining";
    } else if (hoursRemaining < 24) {
      return `${Math.round(hoursRemaining)} hours remaining`;
    } else {
      const days = Math.round(hoursRemaining / 24);
      return `${days} day${days > 1 ? "s" : ""} remaining`;
    }
  }

  /**
   * Send immediate reminder for a specific stage (manual trigger)
   */
  async sendImmediateReminder(stageId: string): Promise<DeadlineReminderResult> {
    const stage = await this.stageRepository.findOne({
      where: { id: stageId },
    });

    if (!stage) {
      throw new Error("Stage not found");
    }

    const hoursRemaining = Math.max(
      0,
      (stage.deadline.getTime() - Date.now()) / (60 * 60 * 1000)
    );

    return this.sendReminderForStage(stage, hoursRemaining);
  }
}
