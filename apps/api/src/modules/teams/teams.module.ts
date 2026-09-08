import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Team,
  TeamMember,
  TeamInvitation,
} from "../../database/entities/team.entity";
import { Participant } from "../../database/entities/participant.entity";
import { Cohort } from "../../database/entities/cohort.entity";
import { Brief } from "../../database/entities/brief.entity";
import { ChatChannel, ChannelMember } from "../../database/entities/chat.entity";
import { TeamsController, InvitationsController } from "./teams.controller";
import { TeamsService } from "./teams.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      TeamInvitation,
      Participant,
      Cohort,
      Brief,
      ChatChannel,
      ChannelMember,
    ]),
  ],
  controllers: [TeamsController, InvitationsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
