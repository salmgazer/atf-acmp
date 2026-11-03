import { AuthModule } from "@/auth/auth.module";
import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { ChannelsController } from "./chat.controller";
import {
  ChatChannel,
  ChatMessage,
  ChannelMember,
  MessageReaction,
  TypingIndicator,
} from "@/database/entities/chat.entity";
import { Team } from "@/database/entities/team.entity";
import { MentorsModule } from "@/modules/mentors/mentors.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ChatChannel,
      ChatMessage,
      ChannelMember,
      MessageReaction,
      TypingIndicator,
      Team,
    ]),
    forwardRef(() => MentorsModule),
    NotificationsModule,
  ],
  controllers: [ChannelsController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
