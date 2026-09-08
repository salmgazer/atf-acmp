import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, Like, In } from "typeorm";
import { AuditLog, AuditAction } from "@/database/entities/audit-log.entity";
import {
  AuditLogQueryDto,
  CreateAuditLogDto,
  AuditLogStatsDto,
} from "./dto/audit.dto";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>
  ) {}

  /**
   * Create an audit log entry
   */
  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    try {
      // Calculate changes if before and after are provided
      let changes: Record<string, { from: any; to: any }> | undefined;
      if (dto.before && dto.after) {
        changes = this.calculateChanges(dto.before, dto.after);
      }

      const auditLog = this.auditLogRepo.create({
        ...dto,
        changes,
      });

      return await this.auditLogRepo.save(auditLog);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      // Don't throw - audit logging should not break the main operation
      return null as any;
    }
  }

  /**
   * Find all audit logs with filters
   */
  async findAll(query: AuditLogQueryDto): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      actorId,
      actorEmail,
      action,
      entityType,
      entityId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.auditLogRepo
      .createQueryBuilder("audit")
      .leftJoinAndSelect("audit.actor", "actor")
      .orderBy("audit.createdAt", "DESC");

    if (actorId) {
      qb.andWhere("audit.actorId = :actorId", { actorId });
    }

    if (actorEmail) {
      qb.andWhere("LOWER(audit.actorEmail) LIKE LOWER(:actorEmail)", {
        actorEmail: `%${actorEmail}%`,
      });
    }

    if (action) {
      qb.andWhere("audit.action = :action", { action });
    }

    if (entityType) {
      qb.andWhere("audit.entityType = :entityType", { entityType });
    }

    if (entityId) {
      qb.andWhere("audit.entityId = :entityId", { entityId });
    }

    if (search) {
      qb.andWhere(
        "(LOWER(audit.description) LIKE LOWER(:search) OR LOWER(audit.entityName) LIKE LOWER(:search) OR LOWER(audit.actorEmail) LIKE LOWER(:search))",
        { search: `%${search}%` }
      );
    }

    if (startDate) {
      qb.andWhere("audit.createdAt >= :startDate", { startDate: new Date(startDate) });
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      qb.andWhere("audit.createdAt <= :endDate", { endDate: endDateTime });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find audit log by ID
   */
  async findOne(id: string): Promise<AuditLog | null> {
    return this.auditLogRepo.findOne({
      where: { id },
      relations: ["actor"],
    });
  }

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      relations: ["actor"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get audit logs by actor
   */
  async findByActor(actorId: string, limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { actorId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  /**
   * Get audit statistics
   */
  async getStats(): Promise<AuditLogStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total logs
    const totalLogs = await this.auditLogRepo.count();

    // Today's logs
    const todayLogs = await this.auditLogRepo.count({
      where: {
        createdAt: Between(today, new Date()),
      },
    });

    // Action breakdown
    const actionBreakdownRaw = await this.auditLogRepo
      .createQueryBuilder("audit")
      .select("audit.action", "action")
      .addSelect("COUNT(*)", "count")
      .groupBy("audit.action")
      .getRawMany();

    const actionBreakdown: Record<string, number> = {};
    actionBreakdownRaw.forEach((row) => {
      actionBreakdown[row.action] = parseInt(row.count, 10);
    });

    // Entity type breakdown
    const entityTypeBreakdownRaw = await this.auditLogRepo
      .createQueryBuilder("audit")
      .select("audit.entityType", "entityType")
      .addSelect("COUNT(*)", "count")
      .groupBy("audit.entityType")
      .orderBy("count", "DESC")
      .limit(10)
      .getRawMany();

    const entityTypeBreakdown: Record<string, number> = {};
    entityTypeBreakdownRaw.forEach((row) => {
      entityTypeBreakdown[row.entityType] = parseInt(row.count, 10);
    });

    // Top actors (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topActorsRaw = await this.auditLogRepo
      .createQueryBuilder("audit")
      .select("audit.actorId", "actorId")
      .addSelect("audit.actorEmail", "actorEmail")
      .addSelect("COUNT(*)", "count")
      .where("audit.createdAt >= :thirtyDaysAgo", { thirtyDaysAgo })
      .andWhere("audit.actorId IS NOT NULL")
      .groupBy("audit.actorId")
      .addGroupBy("audit.actorEmail")
      .orderBy("count", "DESC")
      .limit(10)
      .getRawMany();

    const topActors = topActorsRaw.map((row) => ({
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      count: parseInt(row.count, 10),
    }));

    return {
      totalLogs,
      todayLogs,
      actionBreakdown,
      entityTypeBreakdown,
      topActors,
    };
  }

  /**
   * Get distinct entity types for filtering
   */
  async getEntityTypes(): Promise<string[]> {
    const result = await this.auditLogRepo
      .createQueryBuilder("audit")
      .select("DISTINCT audit.entityType", "entityType")
      .orderBy("audit.entityType", "ASC")
      .getRawMany();

    return result.map((row) => row.entityType);
  }

  /**
   * Calculate changes between before and after states
   */
  private calculateChanges(
    before: Record<string, any>,
    after: Record<string, any>
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    // Fields to ignore in change tracking
    const ignoredFields = ["updatedAt", "createdAt", "deletedAt", "password", "passwordHash"];

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (ignoredFields.includes(key)) continue;

      const beforeValue = before[key];
      const afterValue = after[key];

      // Deep comparison for objects/arrays
      const isDifferent = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);

      if (isDifferent) {
        changes[key] = { from: beforeValue, to: afterValue };
      }
    }

    return changes;
  }

  /**
   * Helper to create audit log for common operations
   */
  async logCreate(
    actorId: string | undefined,
    actorEmail: string | undefined,
    entityType: string,
    entityId: string,
    entityName: string | undefined,
    data: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.CREATE,
      entityType,
      entityId,
      entityName,
      after: data,
      description: `Created ${entityType}: ${entityName || entityId}`,
      ...context,
    });
  }

  async logUpdate(
    actorId: string | undefined,
    actorEmail: string | undefined,
    entityType: string,
    entityId: string,
    entityName: string | undefined,
    before: Record<string, any>,
    after: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.UPDATE,
      entityType,
      entityId,
      entityName,
      before,
      after,
      description: `Updated ${entityType}: ${entityName || entityId}`,
      ...context,
    });
  }

  async logDelete(
    actorId: string | undefined,
    actorEmail: string | undefined,
    entityType: string,
    entityId: string,
    entityName: string | undefined,
    data: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.DELETE,
      entityType,
      entityId,
      entityName,
      before: data,
      description: `Deleted ${entityType}: ${entityName || entityId}`,
      ...context,
    });
  }

  async logStatusChange(
    actorId: string | undefined,
    actorEmail: string | undefined,
    entityType: string,
    entityId: string,
    entityName: string | undefined,
    fromStatus: string,
    toStatus: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.STATUS_CHANGE,
      entityType,
      entityId,
      entityName,
      before: { status: fromStatus },
      after: { status: toStatus },
      description: `Changed ${entityType} status from ${fromStatus} to ${toStatus}`,
      ...context,
    });
  }

  async logLogin(
    actorId: string,
    actorEmail: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.LOGIN,
      entityType: "User",
      entityId: actorId,
      description: `User logged in: ${actorEmail}`,
      ...context,
    });
  }

  async logLogout(
    actorId: string,
    actorEmail: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.LOGOUT,
      entityType: "User",
      entityId: actorId,
      description: `User logged out: ${actorEmail}`,
      ...context,
    });
  }

  async logPasswordChange(
    actorId: string,
    actorEmail: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: "User",
      entityId: actorId,
      description: `User changed password: ${actorEmail}`,
      ...context,
    });
  }

  async logBulkImport(
    actorId: string | undefined,
    actorEmail: string | undefined,
    entityType: string,
    count: number,
    metadata?: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      actorId,
      actorEmail,
      action: AuditAction.BULK_IMPORT,
      entityType,
      description: `Bulk imported ${count} ${entityType} records`,
      metadata: { count, ...metadata },
      ...context,
    });
  }
}
