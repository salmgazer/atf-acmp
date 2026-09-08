import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ChannelType, SenderType, MessageType } from "@/database/entities/chat.entity";

// ============ Channel DTOs ============

export class CreateChannelDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ChannelType })
  @IsEnum(ChannelType)
  type: ChannelType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class UpdateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

// ============ Message DTOs ============

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  @ApiPropertyOptional({ enum: MessageType })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  attachmentSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentMimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class EditMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class MessagesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  after?: string;
}

// ============ Member DTOs ============

export class AddMemberDto {
  @ApiProperty()
  @IsString()
  memberId: string;

  @ApiProperty({ enum: SenderType })
  @IsEnum(SenderType)
  memberType: SenderType;

  @ApiProperty()
  @IsString()
  memberName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memberAvatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

export class RemoveMemberDto {
  @ApiProperty()
  @IsString()
  memberId: string;

  @ApiProperty({ enum: SenderType })
  @IsEnum(SenderType)
  memberType: SenderType;
}

// ============ Reaction DTOs ============

export class AddReactionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji: string;
}

// ============ Response DTOs ============

export class ChannelResponseDto {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  cohortId?: string;
  teamId?: string;
  isPrivate: boolean;
  isArchived: boolean;
  memberCount: number;
  createdAt: Date;
}

export class MessageResponseDto {
  id: string;
  channelId: string;
  senderId: string;
  senderType: SenderType;
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  messageType: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
  replyToId?: string;
  replyTo?: MessageResponseDto;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  reactions: ReactionGroupDto[];
  createdAt: Date;
}

export class ReactionGroupDto {
  emoji: string;
  count: number;
  reactors: Array<{
    id: string;
    type: SenderType;
  }>;
}

export class MemberResponseDto {
  id: string;
  memberId: string;
  memberType: SenderType;
  memberName: string;
  memberAvatarUrl?: string;
  isAdmin: boolean;
  isMuted: boolean;
  joinedAt: Date;
  lastReadAt?: Date;
}

export class ChannelWithUnreadDto {
  channel: ChannelResponseDto;
  latestMessage?: MessageResponseDto;
  unreadCount: number;
}
