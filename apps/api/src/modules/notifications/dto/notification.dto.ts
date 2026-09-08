import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsObject,
  IsDateString,
  Min,
  Max,
} from "class-validator";
import {
  NotificationType,
  NotificationRecipientType,
  NotificationPriority,
} from "@/database/entities/notification.entity";

// ============ Notification DTOs ============

export class CreateNotificationDto {
  @IsUUID()
  recipientId: string;

  @IsEnum(NotificationRecipientType)
  recipientType: NotificationRecipientType;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  groupKey?: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}

export class BulkNotificationDto {
  @IsUUID("4", { each: true })
  recipientIds: string[];

  @IsEnum(NotificationRecipientType)
  recipientType: NotificationRecipientType;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;
}

export class NotificationQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

// ============ Preference DTOs ============

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsObject()
  typeSettings?: Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

// ============ Push Token DTOs ============

export class RegisterPushTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

// ============ Response DTOs ============

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  summary?: string;
  data?: Record<string, any>;
  actionUrl?: string;
  iconName?: string;
  isRead: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  createdAt: Date;
}

export class PaginatedNotificationsDto {
  data: NotificationResponseDto[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class NotificationCountDto {
  total: number;
  unread: number;
}
