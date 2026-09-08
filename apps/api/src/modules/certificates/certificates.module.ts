import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Certificate } from "@/database/entities/certificate.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Evaluation } from "@/database/entities/evaluation.entity";
import { Brief } from "@/database/entities/brief.entity";
import { LeaderboardModule } from "@/modules/leaderboard/leaderboard.module";
import { CertificatesService } from "./certificates.service";
import {
  CertificatesController,
  ParticipantCertificatesController,
  AdminCertificatesController,
} from "./certificates.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Certificate,
      Participant,
      Team,
      TeamMember,
      Cohort,
      Evaluation,
      Brief,
    ]),
    LeaderboardModule,
  ],
  controllers: [
    CertificatesController,
    ParticipantCertificatesController,
    AdminCertificatesController,
  ],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
