import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ChatService } from "./chat.service";
import { ChatGateway } from "./chat.gateway";
import {
  CreateChannelDto,
  UpdateChannelDto,
  SendMessageDto,
  EditMessageDto,
  MessagesQueryDto,
  AddMemberDto,
  RemoveMemberDto,
  AddReactionDto,
} from "./dto/chat.dto";
import { SenderType } from "@/database/entities/chat.entity";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { MentorsService } from "@/modules/mentors/mentors.service";

// Map user roles to sender types
function getSenderType(role: string): SenderType {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "super_admin" || normalizedRole === "program_manager" || normalizedRole === "reviewer" || normalizedRole === "evaluator") {
    return SenderType.STAFF;
  }
  if (normalizedRole === "mentor") {
    return SenderType.MENTOR;
  }
  if (normalizedRole === "organization" || normalizedRole === "org_admin") {
    return SenderType.ORGANIZATION;
  }
  return SenderType.PARTICIPANT;
}

@ApiTags("Chat - Channels")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("chat/channels")
export class ChannelsController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly mentorsService: MentorsService,
  ) {}

  /**
   * Get the effective member ID for channel operations.
   * For mentors, returns the Mentor entity ID (not User ID) since
   * channel memberships are stored with Mentor entity IDs.
   */
  private async getEffectiveMemberId(user: any, senderType: SenderType): Promise<string> {
    if (senderType === SenderType.MENTOR) {
      const mentor = await this.mentorsService.findByEmail(user.email);
      if (mentor) {
        return mentor.id;
      }
    }
    return user.id;
  }

  @Post()
  @ApiOperation({ summary: "Create a new channel" })
  async createChannel(@Body() dto: CreateChannelDto) {
    return this.chatService.createChannel(dto);
  }

  @Get("my")
  @ApiOperation({ summary: "Get current user's channels" })
  @ApiQuery({ name: "cohortId", required: false, description: "Filter by cohort ID" })
  async getMyChannels(
    @CurrentUser() user: any,
    @Query("cohortId") cohortId?: string
  ) {
    const senderType = getSenderType(user.role);
    const memberId = await this.getEffectiveMemberId(user, senderType);
    return this.chatService.getUserChannelsWithUnread(memberId, senderType, cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get channel by ID" })
  async getChannel(@Param("id", ParseUUIDPipe) id: string) {
    return this.chatService.findChannel(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update channel" })
  async updateChannel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelDto
  ) {
    const channel = await this.chatService.findChannel(id);
    Object.assign(channel, dto);
    // Save would be done via repository in service
    return channel;
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive channel" })
  async archiveChannel(@Param("id", ParseUUIDPipe) id: string) {
    return this.chatService.archiveChannel(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete channel" })
  async deleteChannel(@Param("id", ParseUUIDPipe) id: string) {
    await this.chatService.deleteChannel(id);
  }

  // ============ Members ============

  @Get(":id/members")
  @ApiOperation({ summary: "Get channel members" })
  async getMembers(@Param("id", ParseUUIDPipe) id: string) {
    return this.chatService.getChannelMembers(id);
  }

  @Post(":id/members")
  @ApiOperation({ summary: "Add member to channel" })
  async addMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto
  ) {
    const member = await this.chatService.addMember(id, dto);
    this.chatGateway.emitMemberJoined(id, member);
    return member;
  }

  @Delete(":id/members")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove member from channel" })
  async removeMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RemoveMemberDto
  ) {
    await this.chatService.removeMember(id, dto.memberId, dto.memberType);
    this.chatGateway.emitMemberLeft(id, dto.memberId, dto.memberType);
  }

  @Post(":id/leave")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Leave channel" })
  async leaveChannel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const memberId = await this.getEffectiveMemberId(user, senderType);
    await this.chatService.removeMember(id, memberId, senderType);
    this.chatGateway.emitMemberLeft(id, memberId, senderType);
  }

  // ============ Messages ============

  @Get(":id/messages")
  @ApiOperation({ summary: "Get channel messages" })
  async getMessages(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto
  ) {
    return this.chatService.getMessages(id, query);
  }

  @Post(":id/messages")
  @ApiOperation({ summary: "Send message to channel" })
  async sendMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const senderId = await this.getEffectiveMemberId(user, senderType);
    const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    const message = await this.chatService.createMessage({
      channelId: id,
      senderId: senderId,
      senderType: senderType,
      senderName: senderName,
      content: dto.content,
      messageType: dto.messageType as any,
      attachmentUrl: dto.attachmentUrl,
      attachmentName: dto.attachmentName,
      attachmentSize: dto.attachmentSize,
      attachmentMimeType: dto.attachmentMimeType,
      replyToId: dto.replyToId,
    });

    this.chatGateway.emitNewMessage(id, message);
    return message;
  }

  @Patch(":id/messages/:messageId")
  @ApiOperation({ summary: "Edit message" })
  async editMessage(
    @Param("id", ParseUUIDPipe) channelId: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const senderId = await this.getEffectiveMemberId(user, senderType);
    const message = await this.chatService.editMessage(
      messageId,
      senderId,
      senderType,
      dto.content
    );
    this.chatGateway.emitMessageEdited(channelId, message);
    return message;
  }

  @Delete(":id/messages/:messageId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete message" })
  async deleteMessage(
    @Param("id", ParseUUIDPipe) channelId: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const senderId = await this.getEffectiveMemberId(user, senderType);
    await this.chatService.deleteMessage(messageId, senderId, senderType);
    this.chatGateway.emitMessageDeleted(channelId, messageId);
  }

  // ============ Read Status ============

  @Post(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark channel as read" })
  async markAsRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { messageId?: string },
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const memberId = await this.getEffectiveMemberId(user, senderType);
    await this.chatService.markChannelAsRead(id, memberId, senderType, body.messageId);
  }

  @Get(":id/unread")
  @ApiOperation({ summary: "Get unread count for channel" })
  async getUnreadCount(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const memberId = await this.getEffectiveMemberId(user, senderType);
    const count = await this.chatService.getUnreadCount(id, memberId, senderType);
    return { unreadCount: count };
  }

  // ============ Reactions ============

  @Post(":id/messages/:messageId/reactions")
  @ApiOperation({ summary: "Add reaction to message" })
  async addReaction(
    @Param("id", ParseUUIDPipe) channelId: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Body() dto: AddReactionDto,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const memberId = await this.getEffectiveMemberId(user, senderType);
    return this.chatService.addReaction(messageId, memberId, senderType, dto.emoji);
  }

  @Delete(":id/messages/:messageId/reactions/:emoji")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove reaction from message" })
  async removeReaction(
    @Param("id", ParseUUIDPipe) channelId: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Param("emoji") emoji: string,
    @CurrentUser() user: any
  ) {
    const senderType = getSenderType(user.role);
    const memberId = await this.getEffectiveMemberId(user, senderType);
    await this.chatService.removeReaction(messageId, memberId, senderType, emoji);
  }

  // ============ Online Status ============

  @Get(":id/online")
  @ApiOperation({ summary: "Get online users in channel" })
  async getOnlineUsers(@Param("id", ParseUUIDPipe) id: string) {
    const onlineUsers = await this.chatGateway.getOnlineUsersInChannel(id);
    return { onlineUsers };
  }
}
