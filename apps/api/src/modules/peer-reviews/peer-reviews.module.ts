import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  PeerReviewAssignment,
  PeerReview,
  PeerReviewRubric,
} from "@/database/entities/peer-review.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { PeerReviewsService } from "./peer-reviews.service";
import {
  PeerReviewsController,
  AdminPeerReviewsController,
} from "./peer-reviews.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PeerReviewAssignment,
      PeerReview,
      PeerReviewRubric,
      Team,
      TeamMember,
      Participant,
    ]),
  ],
  controllers: [PeerReviewsController, AdminPeerReviewsController],
  providers: [PeerReviewsService],
  exports: [PeerReviewsService],
})
export class PeerReviewsModule {}
