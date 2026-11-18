import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Brief } from "./brief.entity";
import { FormAnswers } from "@acmp/shared";

/** Private evidence/contact/consent answers never travel with the public brief pool. */
@Entity("team_brief_details")
@Index("team_brief_details_brief_id", ["briefId"], { unique: true })
export class TeamBriefDetails extends BaseEntity {
  @Column({ name: "brief_id", type: "uuid" }) briefId: string;
  @ManyToOne(() => Brief, { onDelete: "CASCADE" }) @JoinColumn({ name: "brief_id", foreignKeyConstraintName: "team_brief_details_brief_fk" }) brief: Brief;
  @Column({ type: "jsonb", default: {} }) answers: FormAnswers;
  @Column({ name: "file_urls", type: "jsonb", default: [] }) fileUrls: Array<{ name: string; url: string; type: string; size: number }>;
  @Column({ name: "submitted_by", type: "uuid", nullable: true }) submittedBy?: string;
  @Column({ name: "contact_verified_by_staff", default: false }) contactVerifiedByStaff: boolean;
  @Column({ type: "jsonb", default: [] }) history: Array<Record<string, unknown>>;
  @Column({ name: "schema_version", default: 1 }) schemaVersion: number;
}
