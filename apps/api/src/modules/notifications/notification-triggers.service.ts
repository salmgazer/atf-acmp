import { Injectable, Logger } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import {
  NotificationType,
  NotificationRecipientType,
  NotificationPriority,
} from "@/database/entities/notification.entity";

/**
 * Service for triggering notifications based on system events.
 * Import and use this service from other modules to send notifications.
 */
@Injectable()
export class NotificationTriggersService {
  private readonly logger = new Logger(NotificationTriggersService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // ============ Team Notifications ============

  async onTeamInvitationReceived(params: {
    participantId: string;
    participantName: string;
    teamId: string;
    teamName: string;
    inviterName: string;
  }) {
    this.logger.log(`Team invitation notification for ${params.participantName}`);

    return this.notificationsService.create({
      recipientId: params.participantId,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.TEAM_INVITATION,
      title: "Team Invitation",
      body: `${params.inviterName} invited you to join "${params.teamName}"`,
      summary: `Invitation from ${params.inviterName}`,
      data: {
        teamId: params.teamId,
        teamName: params.teamName,
        inviterName: params.inviterName,
      },
      actionUrl: `/app/team`,
      iconName: "user-plus",
      priority: NotificationPriority.HIGH,
    });
  }

  async onTeamInvitationAccepted(params: {
    teamLeaderId: string;
    teamId: string;
    teamName: string;
    memberName: string;
  }) {
    return this.notificationsService.create({
      recipientId: params.teamLeaderId,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.TEAM_INVITATION_ACCEPTED,
      title: "Invitation Accepted",
      body: `${params.memberName} has joined your team "${params.teamName}"`,
      data: { teamId: params.teamId, memberName: params.memberName },
      actionUrl: `/app/team`,
      iconName: "users",
    });
  }

  async onTeamInvitationDeclined(params: {
    teamLeaderId: string;
    teamId: string;
    teamName: string;
    memberName: string;
  }) {
    return this.notificationsService.create({
      recipientId: params.teamLeaderId,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.TEAM_INVITATION_DECLINED,
      title: "Invitation Declined",
      body: `${params.memberName} declined to join "${params.teamName}"`,
      data: { teamId: params.teamId, memberName: params.memberName },
      actionUrl: `/app/team`,
      iconName: "users",
    });
  }

  async onTeamMemberLeft(params: {
    teamMemberIds: string[];
    teamId: string;
    teamName: string;
    memberName: string;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.teamMemberIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.TEAM_MEMBER_LEFT,
      title: "Team Member Left",
      body: `${params.memberName} has left "${params.teamName}"`,
      data: { teamId: params.teamId, memberName: params.memberName },
      actionUrl: `/app/team`,
    });
  }

  // ============ Mentor Notifications ============

  async onMentorAssigned(params: {
    teamMemberIds: string[];
    teamId: string;
    teamName: string;
    mentorId: string;
    mentorName: string;
  }) {
    // Notify team members
    await this.notificationsService.createBulk({
      recipientIds: params.teamMemberIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.MENTOR_ASSIGNED,
      title: "Mentor Assigned",
      body: `${params.mentorName} has been assigned as your team's mentor`,
      data: { teamId: params.teamId, mentorId: params.mentorId, mentorName: params.mentorName },
      actionUrl: `/app/team`,
      priority: NotificationPriority.HIGH,
    });

    // Notify mentor
    return this.notificationsService.create({
      recipientId: params.mentorId,
      recipientType: NotificationRecipientType.MENTOR,
      type: NotificationType.MENTOR_ASSIGNED,
      title: "New Team Assignment",
      body: `You have been assigned to mentor "${params.teamName}"`,
      data: { teamId: params.teamId, teamName: params.teamName },
      actionUrl: `/mentor/teams/${params.teamId}`,
      priority: NotificationPriority.HIGH,
    });
  }

  async onMentorSessionScheduled(params: {
    teamMemberIds: string[];
    mentorId: string;
    teamId: string;
    teamName: string;
    sessionDate: Date;
  }) {
    const formattedDate = params.sessionDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    // Notify team members
    await this.notificationsService.createBulk({
      recipientIds: params.teamMemberIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.MENTOR_SESSION_SCHEDULED,
      title: "Mentor Session Scheduled",
      body: `Your mentor session is scheduled for ${formattedDate}`,
      data: {
        teamId: params.teamId,
        sessionDate: params.sessionDate.toISOString(),
      },
      actionUrl: `/app/team`,
      priority: NotificationPriority.HIGH,
    });

    // Notify mentor
    return this.notificationsService.create({
      recipientId: params.mentorId,
      recipientType: NotificationRecipientType.MENTOR,
      type: NotificationType.MENTOR_SESSION_SCHEDULED,
      title: "Session Scheduled",
      body: `Session with "${params.teamName}" scheduled for ${formattedDate}`,
      data: {
        teamId: params.teamId,
        teamName: params.teamName,
        sessionDate: params.sessionDate.toISOString(),
      },
      actionUrl: `/mentor/teams/${params.teamId}`,
    });
  }

  // ============ Brief Notifications ============

  async onBriefStatusChanged(params: {
    organizationId: string;
    briefId: string;
    briefTitle: string;
    oldStatus: string;
    newStatus: string;
    feedback?: string;
  }) {
    // Create user-friendly messages based on status
    let title: string;
    let body: string;
    let priority = NotificationPriority.NORMAL;

    switch (params.newStatus) {
      case "approved":
        title = "Brief Approved! 🎉";
        body = `Great news! Your brief "${params.briefTitle}" has been approved. You can now upload your video pitch.`;
        priority = NotificationPriority.HIGH;
        break;
      case "rejected":
        title = "Brief Not Approved";
        body = `Your brief "${params.briefTitle}" was not approved. Please review the feedback and consider resubmitting.`;
        priority = NotificationPriority.HIGH;
        break;
      case "revision_requested":
        title = "Brief Needs Changes";
        body = `Your brief "${params.briefTitle}" requires some changes before approval. Please review the feedback and update your submission.`;
        priority = NotificationPriority.HIGH;
        break;
      case "in_review":
        title = "Brief Under Review";
        body = `Your brief "${params.briefTitle}" is now being reviewed by our team.`;
        break;
      default:
        title = "Brief Status Updated";
        body = `Your brief "${params.briefTitle}" status changed to ${params.newStatus.replace(/_/g, " ")}`;
    }

    return this.notificationsService.create({
      recipientId: params.organizationId,
      recipientType: NotificationRecipientType.ORGANIZATION,
      type: NotificationType.BRIEF_STATUS_CHANGED,
      title,
      body,
      data: {
        briefId: params.briefId,
        oldStatus: params.oldStatus,
        newStatus: params.newStatus,
        feedback: params.feedback,
      },
      actionUrl: `/org/briefs/${params.briefId}`,
      priority,
    });
  }

  async onBriefSelected(params: {
    teamMemberIds: string[];
    teamId: string;
    briefId: string;
    briefTitle: string;
    organizationName: string;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.teamMemberIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.BRIEF_SELECTED,
      title: "Brief Assigned",
      body: `Your team has been assigned to "${params.briefTitle}" by ${params.organizationName}`,
      data: {
        teamId: params.teamId,
        briefId: params.briefId,
        briefTitle: params.briefTitle,
      },
      actionUrl: `/app/briefs/${params.briefId}`,
      priority: NotificationPriority.HIGH,
    });
  }

  async onBriefSubmitted(params: {
    staffUserIds: string[];
    organizationName: string;
    briefId: string;
    briefTitle: string;
    verticalName?: string;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.staffUserIds,
      recipientType: NotificationRecipientType.USER,
      type: NotificationType.BRIEF_SUBMITTED,
      title: "New Brief Submitted",
      body: `${params.organizationName} submitted a new brief: "${params.briefTitle}"${params.verticalName ? ` in ${params.verticalName}` : ""}`,
      data: {
        briefId: params.briefId,
        briefTitle: params.briefTitle,
        organizationName: params.organizationName,
        verticalName: params.verticalName,
      },
      actionUrl: `/portal/briefs/${params.briefId}`,
      priority: NotificationPriority.HIGH,
    });
  }

  // ============ Submission Notifications ============

  async onSubmissionReceived(params: {
    organizationId: string;
    teamId: string;
    teamName: string;
    briefId: string;
    briefTitle: string;
    stageName: string;
  }) {
    return this.notificationsService.create({
      recipientId: params.organizationId,
      recipientType: NotificationRecipientType.ORGANIZATION,
      type: NotificationType.SUBMISSION_RECEIVED,
      title: "New Submission",
      body: `${params.teamName} submitted their ${params.stageName} for "${params.briefTitle}"`,
      data: {
        teamId: params.teamId,
        briefId: params.briefId,
        stageName: params.stageName,
      },
      actionUrl: `/org/briefs/${params.briefId}/submissions`,
    });
  }

  async onSubmissionDeadlineApproaching(params: {
    participantIds: string[];
    stageId: string;
    stageName: string;
    deadline: Date;
    hoursRemaining: number;
  }) {
    const formattedDeadline = params.deadline.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return this.notificationsService.createBulk({
      recipientIds: params.participantIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.SUBMISSION_DEADLINE,
      title: "Deadline Approaching",
      body: `${params.stageName} submission due in ${params.hoursRemaining} hours (${formattedDeadline})`,
      data: {
        stageId: params.stageId,
        deadline: params.deadline.toISOString(),
        hoursRemaining: params.hoursRemaining,
      },
      actionUrl: `/app/submissions`,
      priority: params.hoursRemaining <= 24 ? NotificationPriority.URGENT : NotificationPriority.HIGH,
    });
  }

  // ============ Chat Notifications ============

  async onChatMessage(params: {
    recipientId: string;
    recipientType: NotificationRecipientType;
    channelId: string;
    channelName: string;
    senderName: string;
    messagePreview: string;
  }) {
    const actionUrl =
      params.recipientType === NotificationRecipientType.PARTICIPANT
        ? `/app/chat?channel=${params.channelId}`
        : params.recipientType === NotificationRecipientType.MENTOR
        ? `/mentor/chat?channel=${params.channelId}`
        : `/portal/chat?channel=${params.channelId}`;

    return this.notificationsService.create({
      recipientId: params.recipientId,
      recipientType: params.recipientType,
      type: NotificationType.CHAT_MESSAGE,
      title: `New message in ${params.channelName}`,
      body: `${params.senderName}: ${params.messagePreview}`,
      summary: params.messagePreview.slice(0, 50),
      data: {
        channelId: params.channelId,
        channelName: params.channelName,
        senderName: params.senderName,
      },
      actionUrl,
      iconName: "message-square",
      groupKey: `chat:${params.channelId}`,
    });
  }

  // ============ Forum Notifications ============

  async onForumReply(params: {
    threadAuthorId: string;
    threadAuthorType: NotificationRecipientType;
    threadId: string;
    threadTitle: string;
    replyAuthorName: string;
    replyPreview: string;
  }) {
    const actionUrl =
      params.threadAuthorType === NotificationRecipientType.PARTICIPANT
        ? `/app/forum/thread/${params.threadId}`
        : `/mentor/forum/thread/${params.threadId}`;

    return this.notificationsService.create({
      recipientId: params.threadAuthorId,
      recipientType: params.threadAuthorType,
      type: NotificationType.FORUM_THREAD_REPLY,
      title: "New reply to your thread",
      body: `${params.replyAuthorName} replied to "${params.threadTitle}"`,
      summary: params.replyPreview.slice(0, 100),
      data: {
        threadId: params.threadId,
        threadTitle: params.threadTitle,
        replyAuthorName: params.replyAuthorName,
      },
      actionUrl,
      iconName: "message-circle",
      groupKey: `forum:${params.threadId}`,
    });
  }

  // ============ Announcement Notifications ============

  async onAnnouncement(params: {
    recipientIds: string[];
    recipientType: NotificationRecipientType;
    title: string;
    body: string;
    actionUrl?: string;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.recipientIds,
      recipientType: params.recipientType,
      type: NotificationType.ANNOUNCEMENT,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      priority: NotificationPriority.HIGH,
    });
  }

  // ============ Deadline Reminders ============

  async onDeadlineReminder(params: {
    participantIds: string[];
    title: string;
    body: string;
    deadline: Date;
    actionUrl: string;
    priority?: NotificationPriority;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.participantIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.DEADLINE_REMINDER,
      title: params.title,
      body: params.body,
      data: { deadline: params.deadline.toISOString() },
      actionUrl: params.actionUrl,
      priority: params.priority || NotificationPriority.HIGH,
    });
  }

  // ============ Evaluation Notifications ============

  async onEvaluationComplete(params: {
    teamMemberIds: string[];
    teamId: string;
    stageName: string;
    score?: number;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.teamMemberIds,
      recipientType: NotificationRecipientType.PARTICIPANT,
      type: NotificationType.EVALUATION_COMPLETE,
      title: "Evaluation Results Available",
      body: `Your ${params.stageName} submission has been evaluated${params.score ? ` - Score: ${params.score}` : ""}`,
      data: { teamId: params.teamId, stageName: params.stageName, score: params.score },
      actionUrl: `/app/submissions`,
      priority: NotificationPriority.HIGH,
    });
  }

  // ============ System Alerts ============

  async sendSystemAlert(params: {
    recipientIds: string[];
    recipientType: NotificationRecipientType;
    title: string;
    body: string;
    priority?: NotificationPriority;
  }) {
    return this.notificationsService.createBulk({
      recipientIds: params.recipientIds,
      recipientType: params.recipientType,
      type: NotificationType.SYSTEM_ALERT,
      title: params.title,
      body: params.body,
      priority: params.priority || NotificationPriority.URGENT,
    });
  }
}
