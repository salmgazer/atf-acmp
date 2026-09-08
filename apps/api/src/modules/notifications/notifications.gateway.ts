import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NotificationRecipientType } from "@/database/entities/notification.entity";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: NotificationRecipientType;
}

@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: "*",
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers: Map<string, Set<string>> = new Map(); // recipientKey -> socketIds

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub || payload.id;
      
      // Determine user type from JWT payload
      if (payload.role === "participant") {
        client.userType = NotificationRecipientType.PARTICIPANT;
        client.userId = payload.participantId || client.userId;
      } else if (payload.role === "mentor") {
        client.userType = NotificationRecipientType.MENTOR;
        client.userId = payload.mentorId || client.userId;
      } else if (payload.role === "organization") {
        client.userType = NotificationRecipientType.ORGANIZATION;
        client.userId = payload.organizationId || client.userId;
      } else {
        client.userType = NotificationRecipientType.USER;
      }

      const recipientKey = this.getRecipientKey(client.userId!, client.userType!);
      
      // Join user's personal room
      client.join(recipientKey);

      // Track connection
      if (!this.connectedUsers.has(recipientKey)) {
        this.connectedUsers.set(recipientKey, new Set());
      }
      this.connectedUsers.get(recipientKey)!.add(client.id);

      this.logger.log(
        `Client ${client.id} connected as ${client.userType}:${client.userId}`
      );
    } catch (error) {
      this.logger.warn(`Client ${client.id} auth failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId && client.userType) {
      const recipientKey = this.getRecipientKey(client.userId, client.userType);
      const userSockets = this.connectedUsers.get(recipientKey);
      
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(recipientKey);
        }
      }

      this.logger.log(
        `Client ${client.id} disconnected (${client.userType}:${client.userId})`
      );
    }
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: AuthenticatedSocket) {
    // Client explicitly subscribing - already handled in connection
    return { success: true };
  }

  /**
   * Send a new notification to a specific user
   */
  sendNotification(
    recipientId: string,
    recipientType: NotificationRecipientType,
    notification: any
  ) {
    const recipientKey = this.getRecipientKey(recipientId, recipientType);
    this.server.to(recipientKey).emit("notification", notification);
    this.logger.debug(`Sent notification to ${recipientKey}`);
  }

  /**
   * Send updated unread count to a user
   */
  async sendUnreadCount(
    recipientId: string,
    recipientType: NotificationRecipientType
  ) {
    const recipientKey = this.getRecipientKey(recipientId, recipientType);
    // The actual count will be fetched by the client
    this.server.to(recipientKey).emit("unread_count_updated");
  }

  /**
   * Broadcast notification to multiple users
   */
  broadcastNotification(
    recipientIds: string[],
    recipientType: NotificationRecipientType,
    notification: any
  ) {
    for (const recipientId of recipientIds) {
      this.sendNotification(recipientId, recipientType, notification);
    }
  }

  /**
   * Check if a user is currently online
   */
  isUserOnline(
    recipientId: string,
    recipientType: NotificationRecipientType
  ): boolean {
    const recipientKey = this.getRecipientKey(recipientId, recipientType);
    const sockets = this.connectedUsers.get(recipientKey);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * Get count of online users
   */
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  private getRecipientKey(
    recipientId: string,
    recipientType: NotificationRecipientType
  ): string {
    return `${recipientType}:${recipientId}`;
  }
}
