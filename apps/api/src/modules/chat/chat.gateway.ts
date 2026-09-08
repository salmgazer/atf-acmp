import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Logger, UseGuards } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ChatService } from "./chat.service";
import { SenderType } from "@/database/entities/chat.entity";

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    type: SenderType;
    name: string;
    email: string;
  };
}

interface JoinChannelPayload {
  channelId: string;
}

interface LeaveChannelPayload {
  channelId: string;
}

interface SendMessagePayload {
  channelId: string;
  content: string;
  messageType?: "text" | "image" | "file";
  attachmentUrl?: string;
  attachmentName?: string;
  replyToId?: string;
}

interface TypingPayload {
  channelId: string;
  isTyping: boolean;
}

interface MarkReadPayload {
  channelId: string;
  messageId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "/chat",
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers: Map<string, Set<string>> = new Map(); // memberId -> Set<socketId>
  private socketToUser: Map<string, string> = new Map(); // socketId -> memberId

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  afterInit(server: Server) {
    this.logger.log("Chat WebSocket Gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.emit("error", { message: "Authentication required" });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`Client ${client.id} invalid token`);
        client.emit("error", { message: "Invalid token" });
        client.disconnect();
        return;
      }

      // Determine sender type from role
      const senderType = this.getSenderTypeFromRole(payload.role);
      const userName = payload.firstName && payload.lastName 
        ? `${payload.firstName} ${payload.lastName}` 
        : payload.name || payload.email || "Unknown";

      // Store user info on socket
      client.user = {
        id: payload.sub,
        type: senderType,
        name: userName,
        email: payload.email,
      };

      // Track connection
      const memberId = `${senderType}:${payload.sub}`;
      if (!this.connectedUsers.has(memberId)) {
        this.connectedUsers.set(memberId, new Set());
      }
      this.connectedUsers.get(memberId)!.add(client.id);
      this.socketToUser.set(client.id, memberId);

      this.logger.log(
        `Client connected: ${client.id} (${senderType}:${payload.sub})`
      );

      // Auto-join user's channels
      await this.autoJoinChannels(client);

      // Notify client of successful connection
      client.emit("connected", {
        userId: payload.sub,
        userType: senderType,
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit("error", { message: "Connection failed" });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const memberId = this.socketToUser.get(client.id);
    if (memberId) {
      const sockets = this.connectedUsers.get(memberId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.connectedUsers.delete(memberId);
        }
      }
      this.socketToUser.delete(client.id);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join_channel")
  async handleJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinChannelPayload
  ) {
    if (!client.user) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Verify user is member of channel
      const isMember = await this.chatService.isChannelMember(
        payload.channelId,
        client.user.id,
        client.user.type
      );

      if (!isMember) {
        return { success: false, error: "Not a member of this channel" };
      }

      // Join socket room
      client.join(`channel:${payload.channelId}`);
      this.logger.debug(
        `${client.user.id} joined channel:${payload.channelId}`
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Join channel error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage("leave_channel")
  async handleLeaveChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveChannelPayload
  ) {
    client.leave(`channel:${payload.channelId}`);
    return { success: true };
  }

  @SubscribeMessage("send_message")
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload
  ) {
    if (!client.user) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Get channel info to include channel type
      const channel = await this.chatService.findChannel(payload.channelId);
      
      // Create message
      const message = await this.chatService.createMessage({
        channelId: payload.channelId,
        senderId: client.user.id,
        senderType: client.user.type,
        senderName: client.user.name,
        content: payload.content,
        messageType: payload.messageType || "text",
        attachmentUrl: payload.attachmentUrl,
        attachmentName: payload.attachmentName,
        replyToId: payload.replyToId,
      });

      // Broadcast to channel (include channel type for client-side filtering)
      this.server.to(`channel:${payload.channelId}`).emit("new_message", {
        channelId: payload.channelId,
        channelType: channel?.type,
        message,
      });

      // Clear typing indicator
      this.server.to(`channel:${payload.channelId}`).emit("typing_stopped", {
        channelId: payload.channelId,
        userId: client.user.id,
        userType: client.user.type,
      });

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage("typing")
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload
  ) {
    if (!client.user) return;

    const event = payload.isTyping ? "typing_started" : "typing_stopped";
    client.to(`channel:${payload.channelId}`).emit(event, {
      channelId: payload.channelId,
      userId: client.user.id,
      userType: client.user.type,
      userName: client.user.name,
    });
  }

  @SubscribeMessage("mark_read")
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadPayload
  ) {
    if (!client.user) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      await this.chatService.markChannelAsRead(
        payload.channelId,
        client.user.id,
        client.user.type,
        payload.messageId
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============ Helper Methods ============

  private getSenderTypeFromRole(role: string): SenderType {
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

  private async verifyToken(token: string): Promise<any> {
    try {
      const secret = this.configService.get<string>("JWT_SECRET") || "secret";
      return await this.jwtService.verifyAsync(token, { secret });
    } catch (error) {
      return null;
    }
  }

  private async autoJoinChannels(client: AuthenticatedSocket) {
    if (!client.user) return;

    try {
      const channels = await this.chatService.getUserChannels(
        client.user.id,
        client.user.type
      );

      for (const channel of channels) {
        client.join(`channel:${channel.id}`);
      }

      this.logger.debug(
        `${client.user.id} auto-joined ${channels.length} channels`
      );
    } catch (error) {
      this.logger.error(`Auto-join channels error: ${error.message}`);
    }
  }

  // ============ Server-side emit methods ============

  /**
   * Emit a new message to a channel (called from ChatService)
   */
  async emitNewMessage(channelId: string, message: any) {
    // Get channel info to include channel type
    const channel = await this.chatService.findChannel(channelId);
    
    this.server.to(`channel:${channelId}`).emit("new_message", {
      channelId,
      channelType: channel?.type,
      message,
    });
  }

  /**
   * Emit message edited event
   */
  emitMessageEdited(channelId: string, message: any) {
    this.server.to(`channel:${channelId}`).emit("message_edited", {
      channelId,
      message,
    });
  }

  /**
   * Emit message deleted event
   */
  emitMessageDeleted(channelId: string, messageId: string) {
    this.server.to(`channel:${channelId}`).emit("message_deleted", {
      channelId,
      messageId,
    });
  }

  /**
   * Emit member joined event
   */
  emitMemberJoined(channelId: string, member: any) {
    this.server.to(`channel:${channelId}`).emit("member_joined", {
      channelId,
      member,
    });
  }

  /**
   * Emit member left event
   */
  emitMemberLeft(channelId: string, memberId: string, memberType: string) {
    this.server.to(`channel:${channelId}`).emit("member_left", {
      channelId,
      memberId,
      memberType,
    });
  }

  /**
   * Check if a user is currently online
   */
  isUserOnline(memberId: string, memberType: SenderType): boolean {
    const key = `${memberType}:${memberId}`;
    return this.connectedUsers.has(key) && this.connectedUsers.get(key)!.size > 0;
  }

  /**
   * Get online users in a channel
   */
  async getOnlineUsersInChannel(channelId: string): Promise<string[]> {
    const members = await this.chatService.getChannelMembers(channelId);
    return members
      .filter((m) => this.isUserOnline(m.memberId, m.memberType))
      .map((m) => `${m.memberType}:${m.memberId}`);
  }
}
