import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";
import { TeamFormationService } from "./team-formation.service";
import { Team, TeamMember, TeamInvitation } from "@/database/entities/team.entity";
import { Brief } from "@/database/entities/brief.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import {
  Participant,
  ParticipantPreference,
} from "@/database/entities/participant.entity";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { EmailModule } from "@/email/email.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      TeamInvitation,
      Brief,
      Cohort,
      Vertical,
      Participant,
      ParticipantPreference,
    ]),
    ConfigModule,
    NotificationsModule,
    EmailModule,
  ],
  controllers: [MatchingController],
  providers: [MatchingService, TeamFormationService],
  exports: [MatchingService, TeamFormationService],
})
export class MatchingModule {}
