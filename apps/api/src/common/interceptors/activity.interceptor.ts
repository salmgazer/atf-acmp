import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, tap, catchError } from "rxjs";
import { ActivityService } from "@/modules/activity/activity.service";
import { ActivityType, ActivityPortal } from "@/database/entities/activity-log.entity";
import { Role } from "@/database/entities/user.entity";

/**
 * Paths to exclude from activity logging
 * These are typically high-frequency health/status endpoints
 */
const EXCLUDED_PATHS = [
  "/health",
  "/api/health",
  "/favicon.ico",
  // Activity endpoints to avoid recursive logging
  "/admin/activity",
];

/**
 * Paths that are considered "views" rather than API requests
 */
const VIEW_PATHS = [
  "/admin/dashboard",
  "/briefs",
  "/teams",
  "/submissions",
];

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityInterceptor.name);

  constructor(private readonly activityService: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const path = request.path || request.url;
    const method = request.method;

    // Skip excluded paths
    if (this.shouldExclude(path)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: async () => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          await this.logActivity(
            request,
            path,
            method,
            statusCode,
            responseTime
          );
        },
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Still log failed requests (but don't await)
        this.logActivity(
          request,
          path,
          method,
          statusCode,
          responseTime
        ).catch(() => {});

        throw error;
      })
    );
  }

  private shouldExclude(path: string): boolean {
    return EXCLUDED_PATHS.some(
      (excluded) => path === excluded || path.startsWith(excluded)
    );
  }

  private async logActivity(
    request: any,
    path: string,
    method: string,
    statusCode: number,
    responseTimeMs: number
  ): Promise<void> {
    try {
      const user = request.user;
      const activityType = this.determineActivityType(path, method);
      const portal = this.determinePortal(request, user);

      // For participants and organizations, user.id is NOT from the users table
      // Only set userId for staff roles that are actually in the users table
      const isStaffRole = user?.role && [
        Role.SUPER_ADMIN,
        Role.PROGRAM_MANAGER,
        Role.EVALUATOR,
        Role.VIEWER,
      ].includes(user.role);
      
      const userId = isStaffRole ? user?.id : undefined;
      const participantId = user?.role === Role.PARTICIPANT ? user?.participantId || user?.id : undefined;

      await this.activityService.logApiRequest(
        userId,
        participantId,
        user?.cohortId,
        portal,
        this.normalizePath(path),
        method,
        statusCode,
        responseTimeMs,
        {
          ipAddress: this.getIpAddress(request),
          userAgent: request.headers["user-agent"],
        }
      );
    } catch (error) {
      // Log error but don't fail the request
      this.logger.debug(`Failed to log activity: ${error.message}`);
    }
  }

  /**
   * Determine the activity type based on the path and method
   */
  private determineActivityType(path: string, method: string): ActivityType {
    // Login endpoints
    if (path.includes("/auth/login") || path.includes("/auth/verify-code")) {
      return ActivityType.LOGIN;
    }

    // Logout
    if (path.includes("/auth/logout")) {
      return ActivityType.LOGOUT;
    }

    // Token refresh
    if (path.includes("/auth/refresh")) {
      return ActivityType.TOKEN_REFRESH;
    }

    // Submissions
    if (path.includes("/submissions")) {
      if (method === "POST") return ActivityType.SUBMISSION_CREATE;
      if (method === "PUT" || method === "PATCH") return ActivityType.SUBMISSION_UPDATE;
    }

    // Teams
    if (path.includes("/teams")) {
      if (method === "POST") return ActivityType.TEAM_CREATE;
      if (method === "PUT" || method === "PATCH") return ActivityType.TEAM_UPDATE;
    }

    // Briefs
    if (path.includes("/briefs") && method === "GET") {
      return ActivityType.BRIEF_VIEW;
    }

    // Evaluations
    if (path.includes("/evaluations") && method === "POST") {
      return ActivityType.EVALUATION_CREATE;
    }

    // Forum
    if (path.includes("/forum") && method === "POST") {
      return ActivityType.FORUM_POST;
    }

    // Chat
    if (path.includes("/chat") && method === "POST") {
      return ActivityType.CHAT_MESSAGE;
    }

    // Dashboard views
    if (path.includes("/dashboard")) {
      return ActivityType.DASHBOARD_VIEW;
    }

    // Default to API request
    return ActivityType.API_REQUEST;
  }

  /**
   * Determine the portal based on the request path and user role
   */
  private determinePortal(request: any, user: any): ActivityPortal {
    const path = request.path || request.url;

    // Check path patterns first
    if (path.startsWith("/admin") || path.startsWith("/portal")) {
      return ActivityPortal.STAFF;
    }

    if (path.startsWith("/participant") || path.startsWith("/app")) {
      return ActivityPortal.PARTICIPANT;
    }

    if (path.startsWith("/organization") || path.startsWith("/org")) {
      return ActivityPortal.ORGANIZATION;
    }

    if (path.startsWith("/mentor")) {
      return ActivityPortal.MENTOR;
    }

    // Fall back to user role if available
    if (user?.role) {
      switch (user.role) {
        case Role.SUPER_ADMIN:
        case Role.PROGRAM_MANAGER:
        case Role.EVALUATOR:
        case Role.VIEWER:
          return ActivityPortal.STAFF;
        case Role.PARTICIPANT:
          return ActivityPortal.PARTICIPANT;
        case Role.ORGANIZATION:
          return ActivityPortal.ORGANIZATION;
        case Role.MENTOR:
          return ActivityPortal.MENTOR;
      }
    }

    return ActivityPortal.PUBLIC;
  }

  /**
   * Normalize path by removing IDs for better aggregation
   * e.g., /teams/123-456-789 -> /teams/:id
   */
  private normalizePath(path: string): string {
    // UUID pattern
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    
    // Replace UUIDs with :id
    let normalized = path.replace(uuidPattern, ":id");

    // Also replace numeric IDs
    normalized = normalized.replace(/\/\d+(?=\/|$)/g, "/:id");

    return normalized;
  }

  private getIpAddress(request: any): string | undefined {
    return (
      request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.headers["x-real-ip"] ||
      request.connection?.remoteAddress ||
      request.ip
    );
  }
}
