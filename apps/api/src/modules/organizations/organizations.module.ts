import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organization, OrganizationUser } from "@/database/entities/organization.entity";
import { User } from "@/database/entities/user.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsController } from "./organizations.controller";
import { UploadModule } from "@/common/services/upload.module";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PartnerInvitesService, PARTNER_INVITES_QUEUE } from "./partner-invites.service";
import { PartnerInvitesProcessor } from "./partner-invites.processor";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: {
        host: config.get<string>("REDIS_HOST", "localhost"), port: config.get<number>("REDIS_PORT", 6379), password: config.get<string>("REDIS_PASSWORD"),
      } }),
    }),
    BullModule.registerQueue({ name: PARTNER_INVITES_QUEUE }),
    TypeOrmModule.forFeature([Organization, OrganizationUser, User, Vertical]),
    UploadModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, PartnerInvitesService, PartnerInvitesProcessor],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
