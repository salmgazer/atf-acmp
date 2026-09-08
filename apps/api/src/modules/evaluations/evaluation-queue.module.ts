import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EVALUATION_QUEUE_NAME, DEFAULT_JOB_OPTIONS } from "./evaluation.constants";

@Module({
  imports: [
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
  ],
  exports: [BullModule],
})
export class EvaluationQueueModule {}
