import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  MentorsController,
  SessionsController,
  AdminMentorsController,
  MentorPortalController,
} from "./mentors.controller";
import {
  MentorClaimsController,
  MentorClaimSessionsController,
  MentorPortalSessionsController,
  AdminMentorSessionsController,
} from "./mentor-claims.controller";
import {
  MentorAvailabilityController,
  MentorAvailabilityPublicController,
  AdminMentorAvailabilityController,
} from "./mentor-availability.controller";
import { MentorPaymentsController } from "./mentor-payments.controller";
import { MentorsService } from "./mentors.service";
import { MentorClaimsService } from "./mentor-claims.service";
import { MentorClaimsSchedulerService } from "./mentor-claims-scheduler.service";
import { MentorAvailabilityService } from "./mentor-availability.service";
import { MentorPaymentsService } from "./mentor-payments.service";
import {
  Mentor,
  MentorAssignment,
  MentorSession,
  MentorClaim,
  ScheduledSession,
  MentorAvailability,
  MentorAvailabilityException,
  MentorPayment,
} from "@/database/entities/mentor.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { User } from "@/database/entities/user.entity";
import { Stage, Submission } from "@/database/entities/stage.entity";
import { ChatModule } from "@/modules/chat/chat.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Mentor,
      MentorAssignment,
      MentorSession,
      MentorClaim,
      ScheduledSession,
      MentorAvailability,
      MentorAvailabilityException,
      MentorPayment,
      Team,
      TeamMember,
      Cohort,
      User,
      Stage,
      Submission,
    ]),
    forwardRef(() => ChatModule),
    NotificationsModule,
  ],
  controllers: [
    MentorsController,
    SessionsController,
    AdminMentorsController,
    MentorPortalController,
    MentorClaimsController,
    MentorClaimSessionsController,
    MentorPortalSessionsController,
    MentorAvailabilityController,
    MentorAvailabilityPublicController,
    AdminMentorAvailabilityController,
    MentorPaymentsController,
    AdminMentorSessionsController,
  ],
  providers: [MentorsService, MentorClaimsService, MentorClaimsSchedulerService, MentorAvailabilityService, MentorPaymentsService],
  exports: [MentorsService, MentorClaimsService, MentorAvailabilityService, MentorPaymentsService],
})
export class MentorsModule {}
