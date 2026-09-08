import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Team } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Evaluation } from "@/database/entities/evaluation.entity";
import { Stage } from "@/database/entities/stage.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { Brief } from "@/database/entities/brief.entity";
import { LeaderboardService } from "./leaderboard.service";
import { LeaderboardController, AdminLeaderboardController } from "./leaderboard.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      Participant,
      Evaluation,
      Stage,
      Cohort,
      Vertical,
      Brief,
    ]),
  ],
  controllers: [LeaderboardController, AdminLeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
