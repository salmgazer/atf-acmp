import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GoogleCalendarService } from "./google-calendar.service";
import { ZoomService } from "./zoom.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GoogleCalendarService, ZoomService],
  exports: [GoogleCalendarService, ZoomService],
})
export class CalendarModule {}
