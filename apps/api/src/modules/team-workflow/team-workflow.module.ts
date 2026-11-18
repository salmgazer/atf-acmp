import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Team } from "@/database/entities/team.entity";
import { TeamBriefDetails } from "@/database/entities/team-brief-details.entity";
import { UploadModule } from "@/common/services/upload.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TeamWorkflowService } from "./team-workflow.service";
import { AdminTeamWorkflowController, TeamWorkflowController } from "./team-workflow.controller";

@Module({ imports: [TypeOrmModule.forFeature([Team, TeamBriefDetails]), UploadModule, NotificationsModule],
  providers: [TeamWorkflowService], controllers: [TeamWorkflowController, AdminTeamWorkflowController], exports: [TeamWorkflowService] })
export class TeamWorkflowModule {}
