import { Injectable, Inject, Logger } from "@nestjs/common";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  // Cohorts
  COHORT: "cohort",
  COHORT_LIST: "cohorts",
  COHORT_ACTIVE: "cohorts:active",

  // Briefs
  BRIEF: "brief",
  BRIEF_LIST: "briefs",
  BRIEFS_BY_COHORT: "briefs:cohort",

  // Announcements
  ANNOUNCEMENT: "announcement",
  ANNOUNCEMENT_LIST: "announcements",
  ANNOUNCEMENTS_BY_COHORT: "announcements:cohort",

  // Verticals
  VERTICAL: "vertical",
  VERTICAL_LIST: "verticals",

  // Leaderboard
  LEADERBOARD: "leaderboard",
  LEADERBOARD_BY_COHORT: "leaderboard:cohort",

  // Resources
  RESOURCE: "resource",
  RESOURCE_LIST: "resources",

  // Public data
  PUBLIC_COHORTS: "public:cohorts",
  PUBLIC_STATS: "public:stats",
} as const;

/**
 * Cache TTL values in milliseconds
 */
export const CACHE_TTL = {
  SHORT: 30 * 1000, // 30 seconds - for frequently changing data
  MEDIUM: 5 * 60 * 1000, // 5 minutes - for moderately changing data
  LONG: 30 * 60 * 1000, // 30 minutes - for rarely changing data
  HOUR: 60 * 60 * 1000, // 1 hour - for static reference data
} as const;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
      } else {
        this.logger.debug(`Cache MISS: ${key}`);
      }
      return value ?? null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * Note: This is a simple implementation. For Redis, you might want to use SCAN + DEL
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // For now, we'll just log. A more sophisticated implementation would
      // use Redis SCAN command for pattern matching.
      this.logger.debug(`Cache DEL pattern: ${pattern} (not fully implemented)`);
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for ${pattern}: ${error.message}`);
    }
  }

  /**
   * Get or set - returns cached value or executes factory and caches result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Build a cache key from prefix and identifiers
   */
  buildKey(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts].join(":");
  }

  /**
   * Invalidate all cache entries for a cohort
   */
  async invalidateCohort(cohortId: string): Promise<void> {
    const keys = [
      this.buildKey(CACHE_KEYS.COHORT, cohortId),
      this.buildKey(CACHE_KEYS.BRIEFS_BY_COHORT, cohortId),
      this.buildKey(CACHE_KEYS.ANNOUNCEMENTS_BY_COHORT, cohortId),
      this.buildKey(CACHE_KEYS.LEADERBOARD_BY_COHORT, cohortId),
      CACHE_KEYS.COHORT_LIST,
      CACHE_KEYS.COHORT_ACTIVE,
    ];

    await Promise.all(keys.map((key) => this.del(key)));
    this.logger.log(`Invalidated cache for cohort: ${cohortId}`);
  }

  /**
   * Invalidate all cache entries for a brief
   */
  async invalidateBrief(briefId: string, cohortId?: string): Promise<void> {
    const keys = [
      this.buildKey(CACHE_KEYS.BRIEF, briefId),
      CACHE_KEYS.BRIEF_LIST,
    ];

    if (cohortId) {
      keys.push(this.buildKey(CACHE_KEYS.BRIEFS_BY_COHORT, cohortId));
    }

    await Promise.all(keys.map((key) => this.del(key)));
    this.logger.log(`Invalidated cache for brief: ${briefId}`);
  }

  /**
   * Invalidate all cache entries for an announcement
   */
  async invalidateAnnouncement(announcementId: string, cohortId?: string): Promise<void> {
    const keys = [
      this.buildKey(CACHE_KEYS.ANNOUNCEMENT, announcementId),
      CACHE_KEYS.ANNOUNCEMENT_LIST,
    ];

    if (cohortId) {
      keys.push(this.buildKey(CACHE_KEYS.ANNOUNCEMENTS_BY_COHORT, cohortId));
    }

    await Promise.all(keys.map((key) => this.del(key)));
    this.logger.log(`Invalidated cache for announcement: ${announcementId}`);
  }

  /**
   * Invalidate leaderboard cache
   */
  async invalidateLeaderboard(cohortId?: string): Promise<void> {
    const keys: string[] = [CACHE_KEYS.LEADERBOARD];

    if (cohortId) {
      keys.push(this.buildKey(CACHE_KEYS.LEADERBOARD_BY_COHORT, cohortId));
    }

    await Promise.all(keys.map((key) => this.del(key)));
    this.logger.log(`Invalidated leaderboard cache${cohortId ? ` for cohort: ${cohortId}` : ""}`);
  }

  /**
   * Clear all cache (use with caution)
   * Note: This clears the entire cache store
   */
  async clear(): Promise<void> {
    try {
      // cache-manager v7 uses stores array with Keyv instances
      const stores = (this.cacheManager as any).stores;
      if (stores && Array.isArray(stores)) {
        for (const store of stores) {
          if (typeof store.clear === "function") {
            await store.clear();
          }
        }
      }
      this.logger.warn("Cache cleared");
    } catch (error) {
      this.logger.error(`Cache clear error: ${error.message}`);
    }
  }
}
