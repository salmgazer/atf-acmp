import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Stage, Submission, SubmissionHistory } from "@/database/entities/stage.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { SubmissionsService } from "./submissions.service";
import {
  StagesController,
  SubmissionsController,
  AdminStagesController,
  AdminSubmissionsController,
} from "./submissions.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Stage, Submission, SubmissionHistory, Team, TeamMember]),
  ],
  controllers: [
    StagesController,
    SubmissionsController,
    AdminStagesController,
    AdminSubmissionsController,
  ],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
