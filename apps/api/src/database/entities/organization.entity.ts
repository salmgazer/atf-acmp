import { Entity, Column, Index, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";

export enum OrganizationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum OrganizationUserRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

@Entity("organizations")
@Index(["publicSubmission"])
export class Organization extends BaseEntity {
  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  website?: string;

  @Column({ name: "logo_url", nullable: true })
  logoUrl?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true })
  country?: string;

  // Public submission fields
  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  sector?: string;

  @Column({ name: "sector_other", nullable: true })
  sectorOther?: string;

  @Column({ name: "submitter_name", nullable: true })
  submitterName?: string;

  @Column({ name: "submitter_designation", nullable: true })
  submitterDesignation?: string;

  @Column({ name: "submitter_department", nullable: true })
  submitterDepartment?: string;

  @Column({ name: "public_submission", default: false })
  publicSubmission: boolean;

  @Column({ name: "consent_given", default: false })
  consentGiven: boolean;

  @Column({ name: "consent_timestamp", nullable: true })
  consentTimestamp?: Date;

  @Column({ name: "contact_person", nullable: true })
  contactPerson?: string;

  @Column({ name: "contact_phone", nullable: true })
  contactPhone?: string;

  @Column({
    type: "enum",
    enum: OrganizationStatus,
    default: OrganizationStatus.PENDING,
  })
  status: OrganizationStatus;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "approved_at", nullable: true })
  approvedAt?: Date;

  @Column({ name: "approved_by", nullable: true })
  approvedBy?: string;

  @Column({ type: "text", name: "rejection_reason", nullable: true })
  rejectionReason?: string;

  @Column({ name: "cohort_id", nullable: true })
  cohortId?: string;

  @ManyToOne(() => Cohort, { nullable: true })
  @JoinColumn({ name: "cohort_id" })
  cohort?: Cohort;

  @OneToMany(() => OrganizationUser, (orgUser) => orgUser.organization)
  users: OrganizationUser[];
}

@Entity("organization_users")
@Index(["organizationId", "userId"], { unique: true })
export class OrganizationUser extends BaseEntity {
  @Column({ name: "organization_id" })
  organizationId: string;

  @Column({ name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: OrganizationUserRole,
    default: OrganizationUserRole.MEMBER,
  })
  role: OrganizationUserRole;

  @Column({ name: "is_primary", default: false })
  isPrimary: boolean;

  @ManyToOne(() => Organization, (org) => org.users)
  @JoinColumn({ name: "organization_id" })
  organization: Organization;
}
