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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatChannel,
      ChatMessage,
      ChannelMember,
      MessageReaction,
      TypingIndicator,
      Team,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || "secret",
        signOptions: {
          expiresIn: parseInt(configService.get<string>("JWT_EXPIRES_IN") || "604800", 10), // default 7 days in seconds
        },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => MentorsModule),
  ],
  controllers: [ChannelsController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
