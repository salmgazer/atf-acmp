import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, LessThan, IsNull, MoreThan } from "typeorm";
import {
  Notification,
  NotificationPreference,
  PushToken,
  NotificationType,
  NotificationRecipientType,
  NotificationPriority,
} from "@/database/entities/notification.entity";
import {
  CreateNotificationDto,
  BulkNotificationDto,
  NotificationQueryDto,
  UpdatePreferencesDto,
  RegisterPushTokenDto,
  NotificationResponseDto,
  PaginatedNotificationsDto,
  NotificationCountDto,
} from "./dto/notification.dto";
import { NotificationsGateway } from "./notifications.gateway";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
    private readonly gateway: NotificationsGateway
  ) {}

  // ============ Notification CRUD ============

  async create(dto: CreateNotificationDto): Promise<Notification> {
    // Check user preferences
    const preferences = await this.getOrCreatePreferences(
      dto.recipientId,
      dto.recipientType
    );

    // Check if in-app notifications are enabled for this type
    const typeSettings = preferences.typeSettings?.[dto.type];
    const shouldCreateInApp =
      preferences.inAppEnabled && (typeSettings?.inApp !== false);

    if (!shouldCreateInApp) {
      this.logger.debug(
        `In-app notification disabled for ${dto.recipientId}:${dto.type}`
      );
      // Still return a dummy notification for consistency
      return this.notificationRepository.create(dto) as Notification;
    }

    const notification = this.notificationRepository.create({
      recipientId: dto.recipientId,
      recipientType: dto.recipientType,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      summary: dto.summary,
      data: dto.data,
      actionUrl: dto.actionUrl,
      iconName: dto.iconName,
      priority: dto.priority || NotificationPriority.NORMAL,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      groupKey: dto.groupKey,
    });

    const saved = await this.notificationRepository.save(notification);

    // Send real-time notification via WebSocket
    this.gateway.sendNotification(dto.recipientId, dto.recipientType, {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      body: saved.body,
      summary: saved.summary,
      data: saved.data,
      actionUrl: saved.actionUrl,
      iconName: saved.iconName,
      priority: saved.priority,
      createdAt: saved.createdAt,
    });

    // TODO: Send email if enabled
    // TODO: Send push notification if enabled

    return saved;
  }

  async createBulk(dto: BulkNotificationDto): Promise<number> {
    let created = 0;

    for (const recipientId of dto.recipientIds) {
      try {
        await this.create({
          recipientId,
          recipientType: dto.recipientType,
          type: dto.type,
          title: dto.title,
          body: dto.body,
          data: dto.data,
          actionUrl: dto.actionUrl,
          priority: dto.priority,
        });
        created++;
      } catch (error) {
        this.logger.warn(
          `Failed to create notification for ${recipientId}: ${error.message}`
        );
      }
    }

    return created;
  }

  async getNotifications(
    recipientId: string,
    recipientType: NotificationRecipientType,
    query: NotificationQueryDto
  ): Promise<PaginatedNotificationsDto> {
    const { page = 1, limit = 20, unreadOnly, type } = query;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder("n")
      .where("n.recipient_id = :recipientId", { recipientId })
      .andWhere("n.recipient_type = :recipientType", { recipientType })
      .andWhere("(n.expires_at IS NULL OR n.expires_at > :now)", { now: new Date() });

    if (unreadOnly) {
      queryBuilder.andWhere("n.is_read = :isRead", { isRead: false });
    }

    if (type) {
      queryBuilder.andWhere("n.type = :type", { type });
    }

    queryBuilder.orderBy("n.created_at", "DESC");

    const [notifications, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get unread count
    const unreadCount = await this.notificationRepository.count({
      where: {
        recipientId,
        recipientType,
        isRead: false,
      },
    });

    return {
      data: notifications.map((n) => this.mapToResponse(n)),
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(
    recipientId: string,
    recipientType: NotificationRecipientType
  ): Promise<NotificationCountDto> {
    const [total, unread] = await Promise.all([
      this.notificationRepository.count({
        where: { recipientId, recipientType },
      }),
      this.notificationRepository.count({
        where: { recipientId, recipientType, isRead: false },
      }),
    ]);

    return { total, unread };
  }

  async markAsRead(
    id: string,
    recipientId: string,
    recipientType: NotificationRecipientType
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipientId, recipientType },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    notification.isRead = true;
    notification.readAt = new Date();

    const updated = await this.notificationRepository.save(notification);

    // Notify client about the update
    this.gateway.sendUnreadCount(recipientId, recipientType);

    return updated;
  }

  async markAllAsRead(
    recipientId: string,
    recipientType: NotificationRecipientType
  ): Promise<number> {
    const result = await this.notificationRepository.update(
      { recipientId, recipientType, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Notify client
    this.gateway.sendUnreadCount(recipientId, recipientType);

    return result.affected || 0;
  }

  async deleteNotification(
    id: string,
    recipientId: string,
    recipientType: NotificationRecipientType
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipientId, recipientType },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    await this.notificationRepository.softRemove(notification);
  }

  async deleteAllRead(
    recipientId: string,
    recipientType: NotificationRecipientType
  ): Promise<number> {
    const result = await this.notificationRepository.softDelete({
      recipientId,
      recipientType,
      isRead: true,
    });

    return result.affected || 0;
  }

  // ============ Preferences ============

  async getPreferences(
    userId: string,
    userType: NotificationRecipientType
  ): Promise<NotificationPreference> {
    return this.getOrCreatePreferences(userId, userType);
  }

  async updatePreferences(
    userId: string,
    userType: NotificationRecipientType,
    dto: UpdatePreferencesDto
  ): Promise<NotificationPreference> {
    const preferences = await this.getOrCreatePreferences(userId, userType);

    if (dto.inAppEnabled !== undefined) preferences.inAppEnabled = dto.inAppEnabled;
    if (dto.emailEnabled !== undefined) preferences.emailEnabled = dto.emailEnabled;
    if (dto.pushEnabled !== undefined) preferences.pushEnabled = dto.pushEnabled;
    if (dto.typeSettings !== undefined) {
      preferences.typeSettings = {
        ...preferences.typeSettings,
        ...dto.typeSettings,
      };
    }
    if (dto.quietHoursStart !== undefined) preferences.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) preferences.quietHoursEnd = dto.quietHoursEnd;
    if (dto.timezone !== undefined) preferences.timezone = dto.timezone;

    return this.preferenceRepository.save(preferences);
  }

  private async getOrCreatePreferences(
    userId: string,
    userType: NotificationRecipientType
  ): Promise<NotificationPreference> {
    let preferences = await this.preferenceRepository.findOne({
      where: { userId, userType },
    });

    if (!preferences) {
      preferences = this.preferenceRepository.create({
        userId,
        userType,
        inAppEnabled: true,
        emailEnabled: true,
        pushEnabled: true,
      });
      preferences = await this.preferenceRepository.save(preferences);
    }

    return preferences;
  }

  // ============ Push Tokens ============

  async registerPushToken(
    userId: string,
    userType: NotificationRecipientType,
    dto: RegisterPushTokenDto
  ): Promise<PushToken> {
    // Check if token already exists
    let token = await this.pushTokenRepository.findOne({
      where: { token: dto.token },
    });

    if (token) {
      // Update existing token
      token.userId = userId;
      token.userType = userType;
      token.deviceType = dto.deviceType;
      token.deviceName = dto.deviceName;
      token.lastActiveAt = new Date();
      token.isActive = true;
    } else {
      // Create new token
      token = this.pushTokenRepository.create({
        userId,
        userType,
        token: dto.token,
        deviceType: dto.deviceType,
        deviceName: dto.deviceName,
      });
    }

    return this.pushTokenRepository.save(token);
  }

  async removePushToken(token: string): Promise<void> {
    await this.pushTokenRepository.update({ token }, { isActive: false });
  }

  async getUserPushTokens(
    userId: string,
    userType: NotificationRecipientType
  ): Promise<PushToken[]> {
    return this.pushTokenRepository.find({
      where: { userId, userType, isActive: true },
    });
  }

  // ============ Cleanup ============

  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.notificationRepository.softDelete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`Cleaned up ${result.affected} expired notifications`);
    return result.affected || 0;
  }

  // ============ Helpers ============

  private mapToResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      summary: notification.summary,
      data: notification.data,
      actionUrl: notification.actionUrl,
      iconName: notification.iconName,
      isRead: notification.isRead,
      readAt: notification.readAt,
      priority: notification.priority,
      createdAt: notification.createdAt,
    };
  }
}
