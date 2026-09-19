import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organization, OrganizationUser } from "@/database/entities/organization.entity";
import { Brief } from "@/database/entities/brief.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { User } from "@/database/entities/user.entity";
import { BriefsModule } from "@/modules/briefs/briefs.module";
import { EmailModule } from "@/email/email.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationUser, Brief, Cohort, User]),
    BriefsModule, // For BriefScoringService
    EmailModule,
  ],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
