import { Module } from "@nestjs/common";
import { CalendarModule } from "@/modules/calendar/calendar.module";
import { EmailModule } from "@/email/email.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { BriefEventsController } from "./brief-events.controller";
import { BriefEventsService } from "./brief-events.service";

@Module({
  imports: [CalendarModule, EmailModule, NotificationsModule],
  controllers: [BriefEventsController],
  providers: [BriefEventsService],
  exports: [BriefEventsService],
})
export class BriefEventsModule {}
