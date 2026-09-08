import { Throttle, SkipThrottle } from "@nestjs/throttler";

/**
 * Rate limiting decorators for different endpoint types
 */

/**
 * Auth endpoints: 5 requests per minute (login, register, password reset)
 */
export const AuthThrottle = () =>
  Throttle({
    short: { limit: 3, ttl: 1000 },      // 3 per second
    medium: { limit: 5, ttl: 60000 },    // 5 per minute
    long: { limit: 20, ttl: 3600000 },   // 20 per hour
  });

/**
 * File upload endpoints: 10 requests per minute
 */
export const UploadThrottle = () =>
  Throttle({
    short: { limit: 2, ttl: 1000 },      // 2 per second
    medium: { limit: 10, ttl: 60000 },   // 10 per minute
    long: { limit: 100, ttl: 3600000 },  // 100 per hour
  });

/**
 * Standard API endpoints: 100 requests per minute (default)
 */
export const ApiThrottle = () =>
  Throttle({
    short: { limit: 10, ttl: 1000 },     // 10 per second
    medium: { limit: 100, ttl: 60000 },  // 100 per minute
    long: { limit: 1000, ttl: 3600000 }, // 1000 per hour
  });

/**
 * Strict rate limiting for sensitive operations: 3 requests per minute
 */
export const StrictThrottle = () =>
  Throttle({
    short: { limit: 1, ttl: 1000 },      // 1 per second
    medium: { limit: 3, ttl: 60000 },    // 3 per minute
    long: { limit: 10, ttl: 3600000 },   // 10 per hour
  });

/**
 * Bulk operations: 5 requests per minute
 */
export const BulkThrottle = () =>
  Throttle({
    short: { limit: 1, ttl: 1000 },      // 1 per second
    medium: { limit: 5, ttl: 60000 },    // 5 per minute
    long: { limit: 50, ttl: 3600000 },   // 50 per hour
  });

/**
 * Skip rate limiting (for health checks, public static content)
 */
export const NoThrottle = () => SkipThrottle();
