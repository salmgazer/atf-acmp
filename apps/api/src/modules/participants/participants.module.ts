import { AuthModule } from "@/auth/auth.module";
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
import { CohortsModule } from "../cohorts/cohorts.module";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ParticipantInvitesService, PARTICIPANT_INVITES_QUEUE } from "./participant-invites.service";
import { ParticipantInvitesProcessor } from "./participant-invites.processor";
import { ParticipantImportService, PARTICIPANT_IMPORT_QUEUE } from "./participant-import.service";
import { ParticipantImportProcessor } from "./participant-import.processor";
import { ParticipantInviteBatchRecord } from "@/database/entities/participant-invite-batch.entity";
import { ParticipantInviteLedgerService } from "./participant-invite-ledger.service";
import { ParticipantQueueRecoveryService } from "./participant-queue-recovery.service";

@Module({
  imports: [
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: {
        host: config.get<string>("REDIS_HOST", "localhost"),
        port: config.get<number>("REDIS_PORT", 6379),
        password: config.get<string>("REDIS_PASSWORD"),
      } }),
    }),
    BullModule.registerQueue({ name: PARTICIPANT_INVITES_QUEUE }),
    BullModule.registerQueue({ name: PARTICIPANT_IMPORT_QUEUE }),
    TypeOrmModule.forFeature([Participant, ParticipantPreference, Cohort, ParticipantInviteBatchRecord]),
    NotificationsModule,
    UploadModule,
    CohortsModule,
  ],
  controllers: [ParticipantsController],
  providers: [ParticipantsService, ParticipantInvitesService, ParticipantInvitesProcessor, ParticipantImportService, ParticipantImportProcessor, ParticipantInviteLedgerService, ParticipantQueueRecoveryService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
