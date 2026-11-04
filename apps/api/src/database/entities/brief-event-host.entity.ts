import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { BriefEvent } from "./brief-event.entity";

@Entity("brief_event_host_invitations")
@Index("brief_event_host_email_unique", ["eventId", "email"], { unique: true })
export class BriefEventHostInvitation extends BaseEntity {
  @Column({ name: "event_id", type: "uuid" }) eventId: string;
  @ManyToOne(() => BriefEvent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id", foreignKeyConstraintName: "brief_event_host_invitations_event_id_fkey" }) event: BriefEvent;
  @Column({ length: 255 }) email: string;
  @Column({ default: true }) active: boolean;
  @Column({ type: "integer", default: 0 }) sequence: number;
  @Column({ name: "event_revision", type: "integer", default: 0 }) eventRevision: number;
  @Column({ name: "email_sequence", type: "integer", default: -1 }) emailSequence: number;
}
