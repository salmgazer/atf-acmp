import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "./base.entity";

export enum Role {
  SUPER_ADMIN = "super_admin",
  PROGRAM_MANAGER = "program_manager",
  EVALUATOR = "evaluator",
  VIEWER = "viewer",
  ORGANIZATION = "organization",
  PARTICIPANT = "participant",
  MENTOR = "mentor",
}

@Entity("users")
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({ type: "enum", enum: Role })
  role: Role;

  @Column({ name: "first_name", nullable: true })
  firstName?: string;

  @Column({ name: "last_name", nullable: true })
  lastName?: string;

  @Column({ name: "avatar_url", nullable: true })
  avatarUrl?: string;

  @Column({ name: "firebase_uid", nullable: true })
  firebaseUid?: string;

  @Column({ name: "password_hash", nullable: true })
  passwordHash?: string;

  @Column({ name: "must_change_password", default: false })
  mustChangePassword: boolean;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "last_login_at", nullable: true })
  lastLoginAt?: Date;

  @Column({ name: "password_changed_at", nullable: true })
  passwordChangedAt?: Date;
}
