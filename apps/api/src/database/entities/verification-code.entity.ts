import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { Organization } from "./organization.entity";

export enum VerificationCodeType {
  MAGIC_LINK = "magic_link",
  PASSWORD_RESET = "password_reset",
  EMAIL_VERIFICATION = "email_verification",
}

@Entity("verification_codes")
export class VerificationCode extends BaseEntity {
  @Index()
  @Column()
  email: string;

  @Column()
  code: string;

  @Column({ type: "enum", enum: VerificationCodeType })
  type: VerificationCodeType;

  @Column({ name: "expires_at" })
  expiresAt: Date;

  @Column({ name: "used_at", nullable: true })
  usedAt?: Date;

  @Column({ name: "attempts", default: 0 })
  attempts: number;

  @Column({ name: "portal", nullable: true })
  portal?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ name: "user_id", nullable: true })
  userId?: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: "organization_id" })
  organization?: Organization;

  @Column({ name: "organization_id", nullable: true })
  organizationId?: string;

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isUsed() && this.attempts < 5;
  }
}
