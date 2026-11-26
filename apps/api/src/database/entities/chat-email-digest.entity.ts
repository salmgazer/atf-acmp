import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Participant } from "./participant.entity";
import { ChatChannel } from "./chat.entity";

export interface ChatDigestPayload { to: string; firstName: string; teamName: string; chatUrl: string; preferencesUrl: string }

@Entity("chat_email_digests")
@Check("chat_email_digest_status_check", "status IN ('queued','sent','cancelled','failed')")
@Index("chat_email_digest_due", ["status", "dueAt"])
@Index("chat_email_digest_cursor", ["participantId", "channelId", "throughAt"])
@Index("chat_email_digest_cooldown", ["participantId", "sentAt"])
@Index("chat_email_digest_one_pending", ["participantId", "channelId"], { unique: true, where: "status = 'queued'" })
export class ChatEmailDigest {
  @PrimaryGeneratedColumn("uuid") id: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
  @Column({ name: "participant_id", type: "uuid" }) participantId: string;
  @ManyToOne(() => Participant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participant_id", foreignKeyConstraintName: "chat_email_digest_participant_fkey" }) participant: Participant;
  @Column({ name: "channel_id", type: "uuid" }) channelId: string;
  @ManyToOne(() => ChatChannel, { onDelete: "CASCADE" })
  @JoinColumn({ name: "channel_id", foreignKeyConstraintName: "chat_email_digest_channel_fkey" }) channel: ChatChannel;
  @Column({ name: "message_ids", type: "uuid", array: true }) messageIds: string[];
  @Column({ name: "through_at", type: "timestamp" }) throughAt: Date;
  @Column({ name: "due_at", type: "timestamptz" }) dueAt: Date;
  @Column({ type: "varchar", default: "queued" }) status: "queued" | "sent" | "cancelled" | "failed";
  @Column({ type: "integer", default: 0 }) attempts: number;
  @Column({ name: "first_attempt_at", type: "timestamptz", nullable: true }) firstAttemptAt: Date | null;
  @Column({ name: "sent_at", type: "timestamptz", nullable: true }) sentAt: Date | null;
  @Column({ type: "jsonb", nullable: true }) payload: ChatDigestPayload | null;
}
