import { INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Server, ServerOptions } from "socket.io";

export class RedisSocketAdapter extends IoAdapter {
  private pub?: Redis;
  private sub?: Redis;
  private adapter?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext, private readonly config: ConfigService) { super(app); }

  async connect(): Promise<void> {
    const host = this.config.get<string>("REDIS_HOST");
    if (!host) {
      if (["production", "staging"].includes(this.config.get<string>("NODE_ENV") || "")) throw new Error("REDIS_HOST is required for distributed sockets");
      return;
    }
    this.pub = new Redis({ host, port: Number(this.config.get("REDIS_PORT") || 6379), password: this.config.get("REDIS_PASSWORD"), lazyConnect: true, maxRetriesPerRequest: 1 });
    this.sub = this.pub.duplicate({ lazyConnect: true });
    await Promise.all([this.pub.connect(), this.sub.connect()]);
    this.adapter = createAdapter(this.pub, this.sub);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapter) server.adapter(this.adapter);
    return server;
  }

  async dispose(): Promise<void> {
    await Promise.all([this.pub?.quit(), this.sub?.quit()]);
    await super.dispose();
  }
}
