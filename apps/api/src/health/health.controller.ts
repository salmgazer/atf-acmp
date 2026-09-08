import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Public } from "@/common/decorators/public.decorator";
import Redis from "ioredis";

interface HealthStatus {
  status: "ok" | "error";
  timestamp: string;
  uptime: number;
  version?: string;
}

interface DbHealthStatus extends HealthStatus {
  database: {
    status: "connected" | "disconnected";
    responseTime?: number;
  };
}

interface RedisHealthStatus extends HealthStatus {
  redis: {
    status: "connected" | "disconnected" | "not_configured";
    responseTime?: number;
  };
}

interface FullHealthStatus extends HealthStatus {
  database: DbHealthStatus["database"];
  redis: RedisHealthStatus["redis"];
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  private readonly startTime = Date.now();
  private redisClient: Redis | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    // Initialize Redis client if configured
    const redisHost = this.configService.get<string>("REDIS_HOST");
    const redisUrl = this.configService.get<string>("REDIS_URL");
    
    if (redisUrl) {
      this.redisClient = new Redis(redisUrl, { lazyConnect: true });
    } else if (redisHost) {
      this.redisClient = new Redis({
        host: redisHost,
        port: this.configService.get<number>("REDIS_PORT", 6379),
        password: this.configService.get<string>("REDIS_PASSWORD"),
        lazyConnect: true,
      });
    }
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "Basic health check" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  async getHealth(): Promise<HealthStatus> {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || "1.0.0",
    };
  }

  @Get("db")
  @Public()
  @ApiOperation({ summary: "Database health check" })
  @ApiResponse({ status: 200, description: "Database connection status" })
  async getDatabaseHealth(): Promise<DbHealthStatus> {
    const start = Date.now();
    let dbStatus: DbHealthStatus["database"];

    try {
      await this.dataSource.query("SELECT 1");
      dbStatus = {
        status: "connected",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      dbStatus = {
        status: "disconnected",
      };
    }

    return {
      status: dbStatus.status === "connected" ? "ok" : "error",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      database: dbStatus,
    };
  }

  @Get("redis")
  @Public()
  @ApiOperation({ summary: "Redis health check" })
  @ApiResponse({ status: 200, description: "Redis connection status" })
  async getRedisHealth(): Promise<RedisHealthStatus> {
    if (!this.redisClient) {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        redis: {
          status: "not_configured",
        },
      };
    }

    const start = Date.now();
    let redisStatus: RedisHealthStatus["redis"];

    try {
      await this.redisClient.ping();
      redisStatus = {
        status: "connected",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      // Try to connect if not connected
      try {
        await this.redisClient.connect();
        await this.redisClient.ping();
        redisStatus = {
          status: "connected",
          responseTime: Date.now() - start,
        };
      } catch (connectError) {
        redisStatus = {
          status: "disconnected",
        };
      }
    }

    return {
      status: redisStatus.status === "connected" ? "ok" : "error",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      redis: redisStatus,
    };
  }

  @Get("full")
  @Public()
  @ApiOperation({ summary: "Full health check with all services" })
  @ApiResponse({ status: 200, description: "Full health status" })
  async getFullHealth(): Promise<FullHealthStatus> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.getDatabaseHealth(),
      this.getRedisHealth(),
    ]);

    const memoryUsage = process.memoryUsage();

    const dbOk = dbHealth.database.status === "connected";
    const redisOk = redisHealth.redis.status === "connected" || 
                    redisHealth.redis.status === "not_configured";
    const allHealthy = dbOk && redisOk;

    return {
      status: allHealthy ? "ok" : "error",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || "1.0.0",
      database: dbHealth.database,
      redis: redisHealth.redis,
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    };
  }
}
