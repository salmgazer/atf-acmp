import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";
import { TeamFormationService } from "./team-formation.service";
import { Team, TeamMember, TeamInvitation } from "@/database/entities/team.entity";
import { Brief } from "@/database/entities/brief.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import {
  Participant,
  ParticipantPreference,
} from "@/database/entities/participant.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      TeamInvitation,
      Brief,
      Cohort,
      Participant,
      ParticipantPreference,
    ]),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, TeamFormationService],
  exports: [MatchingService, TeamFormationService],
})
export class MatchingModule {}
