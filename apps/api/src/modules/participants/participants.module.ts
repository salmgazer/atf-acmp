import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Participant,
  ParticipantPreference,
} from "../../database/entities/participant.entity";
import { Cohort } from "../../database/entities/cohort.entity";
import { ParticipantsController } from "./participants.controller";
import { ParticipantsService } from "./participants.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { UploadModule } from "@/common/services/upload.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Participant, ParticipantPreference, Cohort]),
    NotificationsModule,
    UploadModule,
  ],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
