import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Stage, Submission, SubmissionHistory } from "@/database/entities/stage.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { User } from "@/database/entities/user.entity";
import { SubmissionsService } from "./submissions.service";
import { DeadlineReminderService } from "./deadline-reminder.service";
import {
  StagesController,
  SubmissionsController,
  AdminStagesController,
  AdminSubmissionsController,
} from "./submissions.controller";
import { UploadModule } from "@/common/services/upload.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Stage, Submission, SubmissionHistory, Team, TeamMember, User]),
    UploadModule,
    NotificationsModule,
  ],
  controllers: [
    StagesController,
    SubmissionsController,
    AdminStagesController,
    AdminSubmissionsController,
  ],
  providers: [SubmissionsService, DeadlineReminderService],
  exports: [SubmissionsService, DeadlineReminderService],
})
export class SubmissionsModule {}
