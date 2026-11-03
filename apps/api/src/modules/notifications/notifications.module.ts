import { AuthModule } from "@/auth/auth.module";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  Notification,
  NotificationPreference,
  PushToken,
} from "@/database/entities/notification.entity";
import { NotificationsService } from "./notifications.service";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationTriggersService } from "./notification-triggers.service";
import { OneSignalService } from "./onesignal.service";
import {
  NotificationsController,
  AdminNotificationsController,
} from "./notifications.controller";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Notification, NotificationPreference, PushToken]),
  ],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationTriggersService,
    OneSignalService,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationTriggersService,
    OneSignalService,
  ],
})
export class NotificationsModule {}
