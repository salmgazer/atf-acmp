import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, from, mergeMap } from "rxjs";
import { DataSource } from "typeorm";
import { AuditService } from "@/modules/audit/audit.service";
import { AUDIT_KEY, AuditMetadata } from "@/common/decorators/audit.decorator";
import { redactSensitive } from "../services/safe-content";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
    private readonly db: DataSource,
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

    const id = request.params?.id;
    const metadata = this.db.entityMetadatas.find(item => item.name === auditMetadata.entityType);
    const before = id && metadata ? this.db.getRepository(metadata.target).findOne({ where: { id } }).then(value => this.sanitizeData(value)).catch(() => undefined) : Promise.resolve(undefined);
    return from(before).pipe(mergeMap(snapshot => next.handle().pipe(
      mergeMap(async (result) => {
          try {
            const entityId = auditMetadata.getEntityId?.(result, args) || id;
            const entityName = auditMetadata.getEntityName?.(result, args);
            const description = auditMetadata.getDescription?.(result, args);

            await this.auditService.log({
              actorId: user?.role === "participant" ? undefined : user?.id,
              actorEmail: user?.email,
              action: auditMetadata.action,
              entityType: auditMetadata.entityType,
              entityId,
              entityName,
              description,
              before: snapshot,
              after: this.sanitizeData(result),
              metadata: { principalId: user?.id, principalRole: user?.role },
              ipAddress: this.getIpAddress(request),
              userAgent: request.headers["user-agent"],
            });
          } catch (error) {
            // Log error but don't fail the request
            this.logger.error(`Failed to create audit log: ${error.message}`);
          }
          return result;
      })
    )));
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
    return redactSensitive(data);
  }
}
