import { Module, Global, Logger } from "@nestjs/common";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createKeyv } from "@keyv/redis";
import { CacheService } from "./cache.service";

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger("CacheModule");
        const redisHost = configService.get<string>("REDIS_HOST");
        const redisPort = configService.get<number>("REDIS_PORT", 6379);
        const redisPassword = configService.get<string>("REDIS_PASSWORD");

        // If no Redis host configured, use in-memory cache
        if (!redisHost) {
          logger.warn(
            "Redis not configured, using in-memory cache. Set REDIS_HOST for distributed caching.",
          );
          return {
            ttl: 60000, // 1 minute default TTL
            max: 1000, // Max 1000 items in memory
          };
        }

        // Configure Redis connection
        const redisUrl = redisPassword
          ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
          : `redis://${redisHost}:${redisPort}`;

        logger.log(`Connecting to Redis at ${redisHost}:${redisPort}`);

        try {
          const keyv = createKeyv(redisUrl, {
            namespace: "acmp",
          });

          return {
            stores: [keyv],
            ttl: 60000, // 1 minute default TTL
          };
        } catch (error) {
          logger.error(`Failed to connect to Redis: ${error.message}`);
          logger.warn("Falling back to in-memory cache");
          return {
            ttl: 60000,
            max: 1000,
          };
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}
