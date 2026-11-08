import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";
import type { ParticipantInviteProgress } from "@/modules/participants/dto/participant-invites.dto";

@Entity("participant_invite_batches")
@Index("participant_invite_batch_state_created", ["state", "createdAt"])
@Check("participant_invite_batch_state_check", "state IN ('queued','active','completed','failed')")
@Check("participant_invite_batch_recipients_check", "cardinality(participant_ids) > 0")
export class ParticipantInviteBatchRecord {
  @PrimaryColumn({ type: "varchar", length: 150 }) id: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt: Date;
  @Column({ name: "requested_by", type: "uuid" }) requestedBy: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: "requested_by", foreignKeyConstraintName: "participant_invite_batches_requested_by_fkey" }) requester: User;
  @Column({ name: "participant_ids", type: "uuid", array: true }) participantIds: string[];
  @Column({ type: "varchar", default: "queued" }) state: "queued" | "active" | "completed" | "failed";
  @Column({ type: "jsonb" }) progress: ParticipantInviteProgress;
  @Column({ type: "text", nullable: true }) error: string | null;
}
