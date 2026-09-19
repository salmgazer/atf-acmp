import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Brief, BriefRevision } from "../../database/entities/brief.entity";
import { Vertical } from "../../database/entities/vertical.entity";
import { BriefsService } from "./briefs.service";
import { BriefsController } from "./briefs.controller";
import { BriefScoringService } from "./brief-scoring.service";
import { UploadModule } from "@/common/services/upload.module";
import { EmailModule } from "@/email/email.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { UsersModule } from "@/modules/users/users.module";
import { VerticalsModule } from "@/modules/verticals/verticals.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Brief, BriefRevision, Vertical]),
    UploadModule,
    EmailModule,
    NotificationsModule,
    UsersModule,
    VerticalsModule,
  ],
  controllers: [BriefsController],
  providers: [BriefsService, BriefScoringService],
  exports: [BriefsService, BriefScoringService],
})
export class BriefsModule {}
