import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GoogleCalendarService } from "./google-calendar.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class CalendarModule {}
