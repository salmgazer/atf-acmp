import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Organization } from "./organization.entity";
import { Vertical } from "./vertical.entity";

export enum BriefStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  IN_REVIEW = "in_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  REVISION_REQUESTED = "revision_requested",
}

@Entity("briefs")
@Index(["cohortId", "status"])
@Index(["organizationId"])
@Index(["verticalId"])
export class Brief extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "text", name: "problem_statement" })
  problemStatement: string;

  @Column({ type: "text", name: "expected_outcomes" })
  expectedOutcomes: string;

  @Column({ name: "vertical_id", nullable: true })
  verticalId?: string;

  @ManyToOne(() => Vertical, { nullable: true })
  @JoinColumn({ name: "vertical_id" })
  vertical?: Vertical;

  @Column({ type: "enum", enum: BriefStatus, default: BriefStatus.DRAFT })
  status: BriefStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "organization_id" })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: "organization_id" })
  organization: Organization;

  @Column({ name: "teams_count", default: 0 })
  teamsCount: number;

  @Column({ name: "max_teams", default: 25 })
  maxTeams: number;

  @Column({ type: "jsonb", default: [] })
  tags: string[];

  @Column({ type: "jsonb", nullable: true })
  resources?: Array<{
    name: string;
    url: string;
    type: string;
  }>;

  // Video pitch (Stage B)
  @Column({ name: "video_url", nullable: true })
  videoUrl?: string;

  @Column({ name: "video_thumbnail_url", nullable: true })
  videoThumbnailUrl?: string;

  @Column({ type: "jsonb", name: "image_urls", default: [] })
  imageUrls: string[];

  // Review fields
  @Column({ type: "text", name: "review_feedback", nullable: true })
  reviewFeedback?: string;

  @Column({ name: "reviewed_by", nullable: true })
  reviewedBy?: string;

  @Column({ name: "reviewed_at", nullable: true })
  reviewedAt?: Date;

  @Column({ name: "submitted_at", nullable: true })
  submittedAt?: Date;

  @Column({ name: "approved_at", nullable: true })
  approvedAt?: Date;

  @Column({ name: "revision_count", default: 0 })
  revisionCount: number;

  @OneToMany(() => BriefRevision, (revision) => revision.brief)
  revisions: BriefRevision[];
}

export enum BriefRevisionAction {
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
  REVISION_REQUESTED = "revision_requested",
  UPDATED = "updated",
}

@Entity("brief_revisions")
@Index(["briefId"])
export class BriefRevision extends BaseEntity {
  @Column({ name: "brief_id" })
  briefId: string;

  @ManyToOne(() => Brief, (brief) => brief.revisions)
  @JoinColumn({ name: "brief_id" })
  brief: Brief;

  @Column({ type: "enum", enum: BriefRevisionAction })
  action: BriefRevisionAction;

  @Column({ name: "actor_id", nullable: true })
  actorId?: string;

  @Column({ name: "actor_name", nullable: true })
  actorName?: string;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @Column({ type: "jsonb", nullable: true })
  previousData?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  newData?: Record<string, any>;
}
