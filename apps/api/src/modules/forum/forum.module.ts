import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  ForumCategory,
  ForumThread,
  ForumReply,
  ForumThreadView,
} from "@/database/entities/forum.entity";
import { ForumService } from "./forum.service";
import { ForumController, AdminForumController } from "./forum.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForumCategory,
      ForumThread,
      ForumReply,
      ForumThreadView,
    ]),
  ],
  controllers: [ForumController, AdminForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
