import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Brief } from "./brief.entity";
import { Participant } from "./participant.entity";

@Entity("brief_events")
@Index("brief_event_brief_start", ["briefId", "startAt"])
@Index("brief_event_host_start", ["zoomHostId", "startAt"])
@Check("brief_event_duration_check", "duration_minutes BETWEEN 15 AND 480 AND end_at = start_at + duration_minutes * interval '1 minute'")
@Check("brief_event_status_check", "status IN ('scheduled', 'cancelled')")
export class BriefEvent extends BaseEntity {
  @Column({ name: "brief_id", type: "uuid" }) briefId: string;
  @ManyToOne(() => Brief, { onDelete: "CASCADE" })
  @JoinColumn({ name: "brief_id", foreignKeyConstraintName: "brief_event_brief_fk" }) brief: Brief;
  @Column({ length: 200 }) title: string;
  @Column({ type: "text" }) description: string;
  @Column({ name: "start_at", type: "timestamptz" }) startAt: Date;
  @Column({ name: "end_at", type: "timestamptz" }) endAt: Date;
  @Column({ length: 100 }) timezone: string;
  @Column({ name: "duration_minutes", type: "integer" }) durationMinutes: number;
  @Column({ length: 16, default: "scheduled" }) status: "scheduled" | "cancelled";
  @Column({ name: "zoom_meeting_id", length: 50 }) zoomMeetingId: string;
  @Column({ name: "zoom_join_url", type: "text" }) zoomJoinUrl: string;
  @Column({ name: "zoom_host_id", length: 255 }) zoomHostId: string;
  @Column({ name: "created_by", type: "uuid" }) createdBy: string;
  @Column({ type: "integer", default: 0 }) revision: number;
  @Column({ name: "zoom_synced_revision", type: "integer", default: 0 }) zoomSyncedRevision: number;
  @Column({ name: "sync_error", type: "text", nullable: true }) syncError: string | null;
}

@Entity("brief_event_attendees")
@Index("brief_event_attendee_unique", ["eventId", "participantId"], { unique: true })
export class BriefEventAttendee extends BaseEntity {
  @Column({ name: "event_id", type: "uuid" }) eventId: string;
  @ManyToOne(() => BriefEvent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id", foreignKeyConstraintName: "brief_event_attendee_event_fk" }) event: BriefEvent;
  @Column({ name: "participant_id", type: "uuid" }) participantId: string;
  @ManyToOne(() => Participant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participant_id", foreignKeyConstraintName: "brief_event_attendee_participant_fk" }) participant: Participant;
  @Column({ length: 255 }) email: string;
  @Column({ default: true }) active: boolean;
  @Column({ type: "integer", default: 0 }) sequence: number;
  @Column({ name: "event_revision", type: "integer", default: 0 }) eventRevision: number;
  @Column({ name: "email_sequence", type: "integer", default: -1 }) emailSequence: number;
  @Column({ name: "notification_sequence", type: "integer", default: -1 }) notificationSequence: number;
  @Column({ name: "push_sequence", type: "integer", default: -1 }) pushSequence: number;
}
