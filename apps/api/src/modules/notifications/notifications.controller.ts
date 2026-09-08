import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { NotificationRecipientType } from "@/database/entities/notification.entity";
import { NotificationsService } from "./notifications.service";
import {
  CreateNotificationDto,
  BulkNotificationDto,
  NotificationQueryDto,
  UpdatePreferencesDto,
  RegisterPushTokenDto,
} from "./dto/notification.dto";

/**
 * User-facing notifications API
 */
@ApiTags("notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("my")
  @ApiOperation({ summary: "Get my notifications" })
  @ApiResponse({ status: 200, description: "Paginated notifications" })
  async getMyNotifications(@Query() query: NotificationQueryDto, @Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    return this.notificationsService.getNotifications(
      recipientId,
      recipientType,
      query
    );
  }

  @Get("count")
  @ApiOperation({ summary: "Get unread notification count" })
  @ApiResponse({ status: 200, description: "Unread count" })
  async getUnreadCount(@Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    return this.notificationsService.getUnreadCount(recipientId, recipientType);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiParam({ name: "id", description: "Notification ID" })
  @ApiResponse({ status: 200, description: "Notification marked as read" })
  async markAsRead(@Param("id") id: string, @Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    await this.notificationsService.markAsRead(id, recipientId, recipientType);
    return { success: true };
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  @ApiResponse({ status: 200, description: "All notifications marked as read" })
  async markAllAsRead(@Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    const count = await this.notificationsService.markAllAsRead(
      recipientId,
      recipientType
    );
    return { success: true, count };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a notification" })
  @ApiParam({ name: "id", description: "Notification ID" })
  @ApiResponse({ status: 200, description: "Notification deleted" })
  async deleteNotification(@Param("id") id: string, @Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    await this.notificationsService.deleteNotification(
      id,
      recipientId,
      recipientType
    );
    return { success: true };
  }

  @Delete("clear-read")
  @ApiOperation({ summary: "Delete all read notifications" })
  @ApiResponse({ status: 200, description: "Read notifications deleted" })
  async deleteAllRead(@Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    const count = await this.notificationsService.deleteAllRead(
      recipientId,
      recipientType
    );
    return { success: true, count };
  }

  // ============ Preferences ============

  @Get("preferences")
  @ApiOperation({ summary: "Get notification preferences" })
  @ApiResponse({ status: 200, description: "Notification preferences" })
  async getPreferences(@Request() req: any) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    return this.notificationsService.getPreferences(recipientId, recipientType);
  }

  @Patch("preferences")
  @ApiOperation({ summary: "Update notification preferences" })
  @ApiResponse({ status: 200, description: "Preferences updated" })
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Request() req: any
  ) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    return this.notificationsService.updatePreferences(
      recipientId,
      recipientType,
      dto
    );
  }

  // ============ Push Tokens ============

  @Post("push-token")
  @ApiOperation({ summary: "Register a push notification token" })
  @ApiResponse({ status: 201, description: "Token registered" })
  async registerPushToken(
    @Body() dto: RegisterPushTokenDto,
    @Request() req: any
  ) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    return this.notificationsService.registerPushToken(
      recipientId,
      recipientType,
      dto
    );
  }

  @Delete("push-token/:token")
  @ApiOperation({ summary: "Remove a push notification token" })
  @ApiParam({ name: "token", description: "Push token" })
  @ApiResponse({ status: 200, description: "Token removed" })
  async removePushToken(@Param("token") token: string) {
    await this.notificationsService.removePushToken(token);
    return { success: true };
  }

  // ============ Helpers ============

  private getRecipientInfo(user: any): {
    recipientId: string;
    recipientType: NotificationRecipientType;
  } {
    if (user.role === "participant") {
      return {
        recipientId: user.participantId || user.id,
        recipientType: NotificationRecipientType.PARTICIPANT,
      };
    } else if (user.role === "mentor") {
      return {
        recipientId: user.mentorId || user.id,
        recipientType: NotificationRecipientType.MENTOR,
      };
    } else if (user.role === "organization") {
      return {
        recipientId: user.organizationId || user.id,
        recipientType: NotificationRecipientType.ORGANIZATION,
      };
    } else {
      return {
        recipientId: user.id,
        recipientType: NotificationRecipientType.USER,
      };
    }
  }
}

/**
 * Admin notifications API - for creating notifications internally
 */
@ApiTags("notifications-admin")
@Controller("admin/notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: "Create a notification for a specific recipient" })
  @ApiResponse({ status: 201, description: "Notification created" })
  async createNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Create bulk notifications (e.g., to all participants)" })
  @ApiResponse({ status: 201, description: "Notifications created" })
  async createBulkNotifications(@Body() dto: BulkNotificationDto) {
    const count = await this.notificationsService.createBulk(dto);
    return { success: true, created: count };
  }

  @Post("cleanup")
  @ApiOperation({ summary: "Clean up expired notifications" })
  @ApiResponse({ status: 200, description: "Expired notifications cleaned up" })
  async cleanupExpired() {
    const count = await this.notificationsService.cleanupExpiredNotifications();
    return { success: true, cleaned: count };
  }
}
