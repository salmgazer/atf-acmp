import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Team,
  TeamMember,
  TeamInvitation,
  TeamMemberRemovalRequest,
} from "../../database/entities/team.entity";
import { Participant } from "../../database/entities/participant.entity";
import { Cohort } from "../../database/entities/cohort.entity";
import { Brief } from "../../database/entities/brief.entity";
import { ChatChannel, ChannelMember } from "../../database/entities/chat.entity";
import { ScheduledSession } from "../../database/entities/mentor.entity";
import { User } from "../../database/entities/user.entity";
import { TeamsController, InvitationsController } from "./teams.controller";
import { TeamsService } from "./teams.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      TeamInvitation,
      TeamMemberRemovalRequest,
      Participant,
      Cohort,
      Brief,
      ChatChannel,
      ChannelMember,
      ScheduledSession,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [TeamsController, InvitationsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
