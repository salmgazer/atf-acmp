import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Brief } from "./brief.entity";
import { Cohort } from "./cohort.entity";
import { User } from "./user.entity";

@Entity("partner_import_records")
@Check("partner_import_records_opportunity_number_check", "opportunity_number BETWEEN 1 AND 3")
@Index("partner_import_source_unique", ["cohortId", "sessionId", "opportunityNumber"], { unique: true })
export class PartnerImportRecord extends BaseEntity {
  @Column({ name: "cohort_id", type: "uuid" }) cohortId: string;
  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id", foreignKeyConstraintName: "partner_import_records_cohort_id_fkey" }) cohort: Cohort;
  @Column({ name: "session_id", type: "uuid" }) sessionId: string;
  @Column({ name: "opportunity_number", type: "integer" }) opportunityNumber: number;
  @Column({ name: "brief_id", type: "uuid" }) briefId: string;
  @ManyToOne(() => Brief, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "brief_id", foreignKeyConstraintName: "partner_import_records_brief_id_fkey" }) brief: Brief;
  @Column({ name: "batch_id", type: "uuid" }) batchId: string;
  @Column({ name: "actor_id", type: "uuid" }) actorId: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: "actor_id", foreignKeyConstraintName: "partner_import_records_actor_id_fkey" }) actor: User;
  @Column({ name: "content_hash", length: 64 }) contentHash: string;
  @Column({ name: "source_name", length: 255 }) sourceName: string;
  @Column({ name: "source_timezone", length: 100 }) sourceTimezone: string;
  @Column({ name: "source_row", type: "integer" }) sourceRow: number;
  @Column({ name: "source_data", type: "jsonb" }) sourceData: Record<string, string>;
}
