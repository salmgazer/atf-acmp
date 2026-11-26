import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";
import type { BuilderFiltersDto } from "@/modules/participants/dto/builders.dto";

export interface BuilderBroadcastProgress {
  total: number; processed: number; sent: number; failed: number; skipped: number;
  failures: { participantId: string; message: string }[];
}

@Entity("builder_broadcasts")
@Index("builder_broadcast_state_created", ["state", "createdAt"])
@Check("builder_broadcasts_state_check", "state IN ('queued','active','completed','failed')")
@Check("builder_broadcasts_recipients_check", "jsonb_typeof(recipients) = 'array' AND jsonb_array_length(recipients) > 0")
export class BuilderBroadcast {
  @PrimaryColumn("uuid") id: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt: Date;
  @Column({ name: "requested_by", type: "uuid" }) requestedBy: string;
  @ManyToOne(() => User) @JoinColumn({ name: "requested_by", foreignKeyConstraintName: "builder_broadcasts_requested_by_fkey" }) requester: User;
  @Column({ type: "jsonb" }) filters: BuilderFiltersDto;
  @Column({ name: "audience_hash", type: "varchar", length: 64 }) audienceHash: string;
  @Column({ type: "varchar", length: 200 }) subject: string;
  @Column({ type: "text" }) message: string;
  @Column({ type: "jsonb" }) recipients: { id: string; email: string; firstName: string }[];
  @Column({ type: "varchar", default: "queued" }) state: "queued" | "active" | "completed" | "failed";
  @Column({ type: "jsonb" }) progress: BuilderBroadcastProgress;
}
