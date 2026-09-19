import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  PASSWORD_CHANGE = "password_change",
  STATUS_CHANGE = "status_change",
  ASSIGNMENT = "assignment",
  BULK_IMPORT = "bulk_import",
  BULK_ACTION = "bulk_action",
  APPROVAL = "approval",
  REJECTION = "rejection",
}

@Entity("audit_logs")
@Index(["entityType", "entityId"])
@Index(["createdAt"])
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ name: "actor_id", nullable: true })
  actorId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "actor_id" })
  actor?: User;

  @Column({ name: "actor_email", nullable: true })
  actorEmail?: string;

  @Column({
    type: "enum",
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ name: "entity_type" })
  entityType: string;

  @Column({ name: "entity_id", nullable: true })
  entityId?: string;

  @Column({ name: "entity_name", nullable: true })
  entityName?: string;

  @Column({ type: "jsonb", nullable: true })
  before?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  after?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  changes?: Record<string, { from: any; to: any }>;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string;

  @Column({ name: "user_agent", nullable: true })
  userAgent?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;
}
