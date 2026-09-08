import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Announcement } from "@/database/entities/announcement.entity";
import { TeamMember } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { AnnouncementsService } from "./announcements.service";
import {
  AdminAnnouncementsController,
  AnnouncementsController,
} from "./announcements.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, TeamMember, Participant])],
  controllers: [AdminAnnouncementsController, AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
