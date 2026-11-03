import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

@Injectable()
export class SocketSessionsService {
  private readonly servers = new Set<Server>();
  register(server: Server): void { this.servers.add(server); }
  revokeSession(id: string): void { for (const server of this.servers) server.in(`session:${id}`).disconnectSockets(true); }
  revokePrincipal(id: string): void { for (const server of this.servers) server.in(`principal:${id}`).disconnectSockets(true); }
  async removeChannelMember(channelId: string, memberId: string, memberType: string): Promise<void> {
    for (const server of this.servers) {
      const sockets = await server.in(`channel:${channelId}`).fetchSockets();
      for (const socket of sockets) if (socket.data.memberKey === `${memberType}:${memberId}`) await socket.leave(`channel:${channelId}`);
    }
  }
}
