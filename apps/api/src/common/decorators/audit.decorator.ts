import { SetMetadata } from "@nestjs/common";
import { AuditAction } from "@/database/entities/audit-log.entity";

export const AUDIT_KEY = "audit";

export interface AuditMetadata {
  action: AuditAction;
  entityType: string;
  getEntityId?: (result: any, args: any[]) => string | undefined;
  getEntityName?: (result: any, args: any[]) => string | undefined;
  getDescription?: (result: any, args: any[]) => string | undefined;
}

/**
 * Decorator to mark a controller method for audit logging
 * 
 * @example
 * @Audit({
 *   action: AuditAction.CREATE,
 *   entityType: 'Cohort',
 *   getEntityId: (result) => result.id,
 *   getEntityName: (result) => result.name,
 * })
 * async create(@Body() dto: CreateCohortDto) { ... }
 */
export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_KEY, metadata);
