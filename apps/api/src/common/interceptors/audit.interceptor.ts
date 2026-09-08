import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, tap } from "rxjs";
import { AuditService } from "@/modules/audit/audit.service";
import { AUDIT_KEY, AuditMetadata } from "@/common/decorators/audit.decorator";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_KEY,
      context.getHandler()
    );

    // If no audit metadata, just pass through
    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const args = [request.params, request.body, request.query];

    return next.handle().pipe(
      tap({
        next: async (result) => {
          try {
            const entityId = auditMetadata.getEntityId?.(result, args);
            const entityName = auditMetadata.getEntityName?.(result, args);
            const description = auditMetadata.getDescription?.(result, args);

            await this.auditService.log({
              actorId: user?.id,
              actorEmail: user?.email,
              action: auditMetadata.action,
              entityType: auditMetadata.entityType,
              entityId,
              entityName,
              description,
              after: this.sanitizeData(result),
              ipAddress: this.getIpAddress(request),
              userAgent: request.headers["user-agent"],
            });
          } catch (error) {
            // Log error but don't fail the request
            this.logger.error(`Failed to create audit log: ${error.message}`);
          }
        },
        error: () => {
          // Don't log failed operations
        },
      })
    );
  }

  private getIpAddress(request: any): string | undefined {
    return (
      request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.headers["x-real-ip"] ||
      request.connection?.remoteAddress ||
      request.ip
    );
  }

  private sanitizeData(data: any): Record<string, any> | undefined {
    if (!data) return undefined;

    // Convert to plain object if needed
    const obj = typeof data.toJSON === "function" ? data.toJSON() : { ...data };

    // Remove sensitive fields
    const sensitiveFields = [
      "password",
      "passwordHash",
      "token",
      "refreshToken",
      "accessToken",
      "secret",
      "apiKey",
    ];

    const sanitized = { ...obj };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }
}
