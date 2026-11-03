import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBriefEvents1793662800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'brief_event'`);
    await q.query(`CREATE TABLE brief_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      brief_id uuid NOT NULL, title varchar(200) NOT NULL, description text NOT NULL,
      start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, timezone varchar(100) NOT NULL, duration_minutes integer NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'scheduled', zoom_meeting_id varchar(50) NOT NULL, zoom_join_url text NOT NULL, zoom_host_id varchar(255) NOT NULL,
      created_by uuid NOT NULL, revision integer NOT NULL DEFAULT 0, zoom_synced_revision integer NOT NULL DEFAULT 0, sync_error text,
      CONSTRAINT brief_event_brief_fk FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE,
      CONSTRAINT brief_event_duration_check CHECK(duration_minutes BETWEEN 15 AND 480 AND end_at = start_at + duration_minutes * interval '1 minute'),
      CONSTRAINT brief_event_status_check CHECK(status IN ('scheduled', 'cancelled'))
    )`);
    await q.query(`CREATE INDEX brief_event_brief_start ON brief_events(brief_id, start_at)`);
    await q.query(`CREATE INDEX brief_event_host_start ON brief_events(zoom_host_id, start_at)`);
    await q.query(`CREATE TABLE brief_event_attendees (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      event_id uuid NOT NULL, participant_id uuid NOT NULL, email varchar(255) NOT NULL, active boolean NOT NULL DEFAULT true,
      sequence integer NOT NULL DEFAULT 0, event_revision integer NOT NULL DEFAULT 0,
      email_sequence integer NOT NULL DEFAULT -1, notification_sequence integer NOT NULL DEFAULT -1, push_sequence integer NOT NULL DEFAULT -1,
      CONSTRAINT brief_event_attendee_event_fk FOREIGN KEY (event_id) REFERENCES brief_events(id) ON DELETE CASCADE,
      CONSTRAINT brief_event_attendee_participant_fk FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )`);
    await q.query(`CREATE UNIQUE INDEX brief_event_attendee_unique ON brief_event_attendees(event_id, participant_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE brief_event_attendees`);
    await q.query(`DROP TABLE brief_events`);
    // PostgreSQL enum values remain valid for existing notification history.
  }
}
