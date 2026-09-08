import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cohort } from "../../database/entities/cohort.entity";
import { Stage } from "../../database/entities/stage.entity";
import { Participant } from "../../database/entities/participant.entity";
import { Team, TeamMember } from "../../database/entities/team.entity";
import { Brief } from "../../database/entities/brief.entity";
import { Organization } from "../../database/entities/organization.entity";
import { ForumCategory } from "../../database/entities/forum.entity";
import { ChatChannel, ChannelMember } from "../../database/entities/chat.entity";
import { User } from "../../database/entities/user.entity";
import { CohortsController } from "./cohorts.controller";
import { CohortsService } from "./cohorts.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cohort, 
      Stage, 
      Participant, 
      Team,
      TeamMember,
      Brief, 
      Organization, 
      ForumCategory,
      ChatChannel,
      ChannelMember,
      User,
    ]),
    AuditModule,
  ],
  controllers: [CohortsController],
  providers: [CohortsService],
  exports: [CohortsService],
})
export class CohortsModule {}
