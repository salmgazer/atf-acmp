import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Team } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Mentor } from "@/database/entities/mentor.entity";
import { Organization } from "@/database/entities/organization.entity";
import { Brief } from "@/database/entities/brief.entity";
import { Submission, Stage } from "@/database/entities/stage.entity";
import { Evaluation } from "@/database/entities/evaluation.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      Participant,
      Mentor,
      Organization,
      Brief,
      Submission,
      Stage,
      Evaluation,
      Vertical,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
