import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Evaluation, EvaluationJob } from "@/database/entities/evaluation.entity";
import { Submission, Stage } from "@/database/entities/stage.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { EvaluationsService } from "./evaluations.service";
import {
  EvaluationsController,
  ParticipantEvaluationsController,
} from "./evaluations.controller";
import { EvaluationProcessor } from "./evaluation.processor";
import { GeminiService } from "./gemini.service";
import { GitHubModule } from "@/modules/github/github.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { EVALUATION_QUEUE_NAME, DEFAULT_JOB_OPTIONS } from "./evaluation.constants";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evaluation,
      EvaluationJob,
      Submission,
      Stage,
      Team,
      TeamMember,
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
          password: configService.get<string>("REDIS_PASSWORD"),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: EVALUATION_QUEUE_NAME,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
    GitHubModule,
    NotificationsModule,
  ],
  controllers: [EvaluationsController, ParticipantEvaluationsController],
  providers: [EvaluationsService, EvaluationProcessor, GeminiService],
  exports: [EvaluationsService, GeminiService],
})
export class EvaluationsModule {}
