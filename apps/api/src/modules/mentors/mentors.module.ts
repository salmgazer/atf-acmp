import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  MentorsController,
  SessionsController,
  AdminMentorsController,
  MentorPortalController,
} from "./mentors.controller";
import { MentorsService } from "./mentors.service";
import {
  Mentor,
  MentorAssignment,
  MentorSession,
} from "@/database/entities/mentor.entity";
import { Team } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { User } from "@/database/entities/user.entity";
import { ChatModule } from "@/modules/chat/chat.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Mentor,
      MentorAssignment,
      MentorSession,
      Team,
      Cohort,
      User,
    ]),
    forwardRef(() => ChatModule),
  ],
  controllers: [
    MentorsController,
    SessionsController,
    AdminMentorsController,
    MentorPortalController,
  ],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}
