import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThan, LessThan } from "typeorm";
import {
  ChatChannel,
  ChatMessage,
  ChannelMember,
  MessageReaction,
  ChannelType,
  SenderType,
  MessageType,
} from "@/database/entities/chat.entity";
import { Team } from "@/database/entities/team.entity";

export interface CreateChannelDto {
  name: string;
  description?: string;
  type: ChannelType;
  cohortId?: string;
  teamId?: string;
  isPrivate?: boolean;
}

export interface CreateMessageDto {
  channelId: string;
  senderId: string;
  senderType: SenderType;
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  messageType?: "text" | "image" | "file";
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
  replyToId?: string;
}

export interface AddMemberDto {
  memberId: string;
  memberType: SenderType;
  memberName: string;
  memberAvatarUrl?: string;
  isAdmin?: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatChannel)
    private readonly channelRepository: Repository<ChatChannel>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(ChannelMember)
    private readonly memberRepository: Repository<ChannelMember>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>
  ) {}

  // ============ Channel Operations ============

  async createChannel(dto: CreateChannelDto): Promise<ChatChannel> {
    const channel = this.channelRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type,
      cohortId: dto.cohortId,
      teamId: dto.teamId,
      isPrivate: dto.isPrivate ?? false,
    });

    return this.channelRepository.save(channel);
  }

  async findChannel(id: string): Promise<ChatChannel> {
    const channel = await this.channelRepository.findOne({
      where: { id },
      relations: ["members"],
    });

    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    return channel;
  }

  async findChannelByTeam(teamId: string, type: ChannelType): Promise<ChatChannel | null> {
    return this.channelRepository.findOne({
      where: { teamId, type },
      relations: ["members"],
    });
  }

  async getUserChannels(
    userId: string,
    userType: SenderType
  ): Promise<ChatChannel[]> {
    // Staff can see all non-private channels (or all channels they're members of)
    if (userType === SenderType.STAFF) {
      // Get channels where staff is a member
      const memberships = await this.memberRepository.find({
        where: {
          memberId: userId,
          memberType: userType,
          leftAt: null as any,
        },
        relations: ["channel"],
      });
      
      const memberChannelIds = memberships.map(m => m.channel?.id).filter(Boolean);
      
      // Also get all non-archived channels (staff can view all)
      const allChannels = await this.channelRepository.find({
        where: { isArchived: false },
        order: { createdAt: "DESC" },
      });
      
      // Combine: staff member channels + all non-archived channels they can view
      const channelMap = new Map<string, ChatChannel>();
      
      // First add member channels
      memberships.forEach(m => {
        if (m.channel) {
          channelMap.set(m.channel.id, m.channel);
        }
      });
      
      // Then add other channels (but ensure no duplicates)
      allChannels.forEach(c => {
        if (!channelMap.has(c.id)) {
          channelMap.set(c.id, c);
        }
      });
      
      return Array.from(channelMap.values());
    }

    // For non-staff, only show channels they're members of
    const memberships = await this.memberRepository.find({
      where: {
        memberId: userId,
        memberType: userType,
        leftAt: null as any,
      },
      relations: ["channel"],
    });

    return memberships.map((m) => m.channel).filter(Boolean);
  }

  async getChannelWithLatestMessage(channelId: string): Promise<{
    channel: ChatChannel;
    latestMessage: ChatMessage | null;
    unreadCount: number;
  }> {
    const channel = await this.findChannel(channelId);

    const latestMessage = await this.messageRepository.findOne({
      where: { channelId, isDeleted: false },
      order: { createdAt: "DESC" },
    });

    return {
      channel,
      latestMessage,
      unreadCount: 0, // Will be calculated per user
    };
  }

  async archiveChannel(id: string): Promise<ChatChannel> {
    const channel = await this.findChannel(id);
    channel.isArchived = true;
    return this.channelRepository.save(channel);
  }

  async deleteChannel(id: string): Promise<void> {
    const channel = await this.findChannel(id);
    await this.channelRepository.softRemove(channel);
  }

  // ============ Member Operations ============

  async addMember(channelId: string, dto: AddMemberDto): Promise<ChannelMember> {
    // Check if already a member
    const existing = await this.memberRepository.findOne({
      where: {
        channelId,
        memberId: dto.memberId,
        memberType: dto.memberType,
      },
    });

    if (existing) {
      // Rejoin if they left
      if (existing.leftAt) {
        existing.leftAt = null as any;
        existing.joinedAt = new Date();
        return this.memberRepository.save(existing);
      }
      return existing;
    }

    const member = this.memberRepository.create({
      channelId,
      memberId: dto.memberId,
      memberType: dto.memberType,
      memberName: dto.memberName,
      memberAvatarUrl: dto.memberAvatarUrl,
      isAdmin: dto.isAdmin ?? false,
    });

    return this.memberRepository.save(member);
  }

  async removeMember(
    channelId: string,
    memberId: string,
    memberType: SenderType
  ): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { channelId, memberId, memberType },
    });

    if (member) {
      member.leftAt = new Date();
      await this.memberRepository.save(member);
    }
  }

  async getChannelMembers(channelId: string): Promise<ChannelMember[]> {
    return this.memberRepository.find({
      where: { channelId, leftAt: null as any },
      order: { joinedAt: "ASC" },
    });
  }

  async isChannelMember(
    channelId: string,
    memberId: string,
    memberType: SenderType
  ): Promise<boolean> {
    // Staff can access all channels
    if (memberType === SenderType.STAFF) {
      return true;
    }
    
    const member = await this.memberRepository.findOne({
      where: { channelId, memberId, memberType, leftAt: null as any },
    });
    return !!member;
  }

  async markChannelAsRead(
    channelId: string,
    memberId: string,
    memberType: SenderType,
    messageId?: string
  ): Promise<void> {
    let member = await this.memberRepository.findOne({
      where: { channelId, memberId, memberType },
    });

    // If staff is not a member, auto-add them when they mark as read
    if (!member && memberType === SenderType.STAFF) {
      member = this.memberRepository.create({
        channelId,
        memberId,
        memberType,
        memberName: "Staff", // Will be updated on next proper action
        isAdmin: false,
      });
    }

    if (member) {
      member.lastReadAt = new Date();
      if (messageId) {
        member.lastReadMessageId = messageId;
      }
      await this.memberRepository.save(member);
    }
  }

  async getUnreadCount(
    channelId: string,
    memberId: string,
    memberType: SenderType
  ): Promise<number> {
    const member = await this.memberRepository.findOne({
      where: { channelId, memberId, memberType },
    });

    // If user is not a member of the channel, they have no unread messages
    // This applies to staff who can view all channels but aren't members
    if (!member) {
      return 0;
    }

    // If member has never read any messages, count all messages as unread
    if (!member.lastReadAt) {
      return this.messageRepository.count({
        where: { channelId, isDeleted: false },
      });
    }

    return this.messageRepository.count({
      where: {
        channelId,
        isDeleted: false,
        createdAt: MoreThan(member.lastReadAt),
      },
    });
  }

  // ============ Message Operations ============

  async createMessage(dto: CreateMessageDto): Promise<ChatMessage> {
    // Verify sender is a member
    const isMember = await this.isChannelMember(
      dto.channelId,
      dto.senderId,
      dto.senderType
    );

    if (!isMember) {
      throw new ForbiddenException("Not a member of this channel");
    }

    const message = this.messageRepository.create({
      channelId: dto.channelId,
      senderId: dto.senderId,
      senderType: dto.senderType,
      senderName: dto.senderName,
      senderAvatarUrl: dto.senderAvatarUrl,
      content: dto.content,
      messageType: (dto.messageType as MessageType) || MessageType.TEXT,
      attachmentUrl: dto.attachmentUrl,
      attachmentName: dto.attachmentName,
      attachmentSize: dto.attachmentSize,
      attachmentMimeType: dto.attachmentMimeType,
      replyToId: dto.replyToId,
    });

    const saved = await this.messageRepository.save(message);

    // Update sender's last read
    await this.markChannelAsRead(dto.channelId, dto.senderId, dto.senderType, saved.id);

    return saved;
  }

  async getMessages(
    channelId: string,
    options: {
      limit?: number;
      before?: string;
      after?: string;
    } = {}
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const limit = options.limit || 50;

    const qb = this.messageRepository
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.replyTo", "replyTo")
      .leftJoinAndSelect("message.reactions", "reactions")
      .where("message.channelId = :channelId", { channelId })
      .andWhere("message.isDeleted = false");

    if (options.before) {
      const beforeMessage = await this.messageRepository.findOne({
        where: { id: options.before },
      });
      if (beforeMessage) {
        qb.andWhere("message.createdAt < :beforeDate", {
          beforeDate: beforeMessage.createdAt,
        });
      }
    }

    if (options.after) {
      const afterMessage = await this.messageRepository.findOne({
        where: { id: options.after },
      });
      if (afterMessage) {
        qb.andWhere("message.createdAt > :afterDate", {
          afterDate: afterMessage.createdAt,
        });
      }
    }

    qb.orderBy("message.createdAt", "DESC").take(limit + 1);

    const messages = await qb.getMany();
    const hasMore = messages.length > limit;

    if (hasMore) {
      messages.pop();
    }

    // Return in chronological order
    return {
      messages: messages.reverse(),
      hasMore,
    };
  }

  async editMessage(
    messageId: string,
    senderId: string,
    senderType: SenderType,
    newContent: string
  ): Promise<ChatMessage> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (message.senderId !== senderId || message.senderType !== senderType) {
      throw new ForbiddenException("Can only edit your own messages");
    }

    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();

    return this.messageRepository.save(message);
  }

  async deleteMessage(
    messageId: string,
    senderId: string,
    senderType: SenderType,
    isAdmin: boolean = false
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    // Only sender or admin can delete
    if (!isAdmin && (message.senderId !== senderId || message.senderType !== senderType)) {
      throw new ForbiddenException("Cannot delete this message");
    }

    message.isDeleted = true;
    message.content = "[Message deleted]";
    await this.messageRepository.save(message);
  }

  // ============ Reaction Operations ============

  async addReaction(
    messageId: string,
    reactorId: string,
    reactorType: SenderType,
    emoji: string
  ): Promise<MessageReaction> {
    const existing = await this.reactionRepository.findOne({
      where: { messageId, reactorId, reactorType, emoji },
    });

    if (existing) {
      return existing;
    }

    const reaction = this.reactionRepository.create({
      messageId,
      reactorId,
      reactorType,
      emoji,
    });

    return this.reactionRepository.save(reaction);
  }

  async removeReaction(
    messageId: string,
    reactorId: string,
    reactorType: SenderType,
    emoji: string
  ): Promise<void> {
    await this.reactionRepository.delete({
      messageId,
      reactorId,
      reactorType,
      emoji,
    });
  }

  // ============ Team Channel Creation ============

  async createTeamChannels(team: Team): Promise<{
    teamChannel: ChatChannel;
    mentorChannel: ChatChannel;
  }> {
    // Create team internal channel
    const teamChannel = await this.createChannel({
      name: `${team.name}`,
      description: "Team discussion channel",
      type: ChannelType.TEAM,
      cohortId: team.cohortId,
      teamId: team.id,
    });

    // Create mentor-team channel
    const mentorChannel = await this.createChannel({
      name: `${team.name} - Mentor`,
      description: "Channel for team and mentor discussions",
      type: ChannelType.MENTOR_TEAM,
      cohortId: team.cohortId,
      teamId: team.id,
    });

    return { teamChannel, mentorChannel };
  }

  async addTeamMembersToChannels(
    teamId: string,
    members: Array<{
      id: string;
      type: SenderType;
      name: string;
      avatarUrl?: string;
    }>
  ): Promise<void> {
    const teamChannel = await this.findChannelByTeam(teamId, ChannelType.TEAM);
    const mentorChannel = await this.findChannelByTeam(teamId, ChannelType.MENTOR_TEAM);

    for (const member of members) {
      if (teamChannel) {
        await this.addMember(teamChannel.id, {
          memberId: member.id,
          memberType: member.type,
          memberName: member.name,
          memberAvatarUrl: member.avatarUrl,
        });
      }
      if (mentorChannel) {
        await this.addMember(mentorChannel.id, {
          memberId: member.id,
          memberType: member.type,
          memberName: member.name,
          memberAvatarUrl: member.avatarUrl,
        });
      }
    }
  }

  async addMentorToTeamChannel(
    teamId: string,
    mentorId: string,
    mentorName: string,
    mentorAvatarUrl?: string
  ): Promise<void> {
    let mentorChannel = await this.findChannelByTeam(teamId, ChannelType.MENTOR_TEAM);

    // If mentor channel doesn't exist, create it
    if (!mentorChannel) {
      const team = await this.teamRepository.findOne({ where: { id: teamId } });
      if (!team) {
        throw new Error(`Team ${teamId} not found`);
      }
      
      mentorChannel = this.channelRepository.create({
        name: `${team.name} - Mentor`,
        description: "Channel for team and mentor discussions",
        type: ChannelType.MENTOR_TEAM,
        cohortId: team.cohortId,
        teamId: team.id,
      });
      await this.channelRepository.save(mentorChannel);
      
      // Also add all team members to the mentor channel
      const teamChannel = await this.findChannelByTeam(teamId, ChannelType.TEAM);
      if (teamChannel) {
        const teamMembers = await this.memberRepository.find({
          where: { channelId: teamChannel.id, leftAt: null as any },
        });
        for (const member of teamMembers) {
          await this.addMember(mentorChannel.id, {
            memberId: member.memberId,
            memberType: member.memberType,
            memberName: member.memberName,
            memberAvatarUrl: member.memberAvatarUrl,
          });
        }
      }
    }

    // Add mentor to the channel
    await this.addMember(mentorChannel.id, {
      memberId: mentorId,
      memberType: SenderType.MENTOR,
      memberName: mentorName,
      memberAvatarUrl: mentorAvatarUrl,
    });
  }

  async removeMentorFromTeamChannel(
    teamId: string,
    mentorId: string
  ): Promise<void> {
    const mentorChannel = await this.findChannelByTeam(teamId, ChannelType.MENTOR_TEAM);

    if (mentorChannel) {
      await this.removeMember(mentorChannel.id, mentorId, SenderType.MENTOR);
    }
  }

  // ============ User Channel List with Unread ============

  async getUserChannelsWithUnread(
    userId: string,
    userType: SenderType
  ): Promise<
    Array<{
      channel: ChatChannel;
      latestMessage: ChatMessage | null;
      unreadCount: number;
    }>
  > {
    const channels = await this.getUserChannels(userId, userType);

    return Promise.all(
      channels.map(async (channel) => {
        const latestMessage = await this.messageRepository.findOne({
          where: { channelId: channel.id, isDeleted: false },
          order: { createdAt: "DESC" },
        });

        const unreadCount = await this.getUnreadCount(
          channel.id,
          userId,
          userType
        );

        return {
          channel,
          latestMessage,
          unreadCount,
        };
      })
    );
  }
}
