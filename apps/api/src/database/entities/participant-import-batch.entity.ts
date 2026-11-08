import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { User } from "./user.entity";

@Entity("participant_import_batches")
@Index("participant_import_batch_cohort_created", ["cohortId", "createdAt"])
@Index("participant_import_batch_recovery", ["state", "createdAt"], { where: "deleted_at IS NULL" })
export class ParticipantImportBatch extends BaseEntity {
  @Column({ name: "cohort_id", type: "uuid" }) cohortId: string;
  @Column({ name: "requested_by", type: "uuid" }) requestedBy: string;
  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id", foreignKeyConstraintName: "participant_import_batches_cohort_id_fkey" }) cohort: Cohort;
  @ManyToOne(() => User)
  @JoinColumn({ name: "requested_by", foreignKeyConstraintName: "participant_import_batches_requested_by_fkey" }) requester: User;
  @Column({ name: "source_name", type: "varchar", length: 255 }) sourceName: string;
  @Column({ type: "varchar", default: "queued" }) state: "queued" | "active" | "completed" | "failed";
  @Column({ type: "jsonb", select: false }) input: Record<string, unknown>;
  @Column({ type: "jsonb", default: {} }) result: Record<string, any>;
  @Column({ type: "text", nullable: true }) error: string | null;
}
