import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamChatEmailFallback1795737600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE chat_channels ADD COLUMN email_notifications_start_at timestamp NOT NULL DEFAULT now()`);
    await q.query(`CREATE TABLE chat_email_digests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(),
      participant_id uuid NOT NULL CONSTRAINT chat_email_digest_participant_fkey REFERENCES participants(id) ON DELETE CASCADE,
      channel_id uuid NOT NULL CONSTRAINT chat_email_digest_channel_fkey REFERENCES chat_channels(id) ON DELETE CASCADE,
      message_ids uuid[] NOT NULL, through_at timestamp NOT NULL, due_at timestamptz NOT NULL,
      status varchar NOT NULL DEFAULT 'queued' CONSTRAINT chat_email_digest_status_check CHECK (status IN ('queued','sent','cancelled','failed')),
      attempts integer NOT NULL DEFAULT 0, first_attempt_at timestamptz, sent_at timestamptz, payload jsonb
    )`);
    await q.query(`CREATE INDEX chat_email_digest_due ON chat_email_digests(status,due_at)`);
    await q.query(`CREATE INDEX chat_email_digest_cursor ON chat_email_digests(participant_id,channel_id,through_at)`);
    await q.query(`CREATE INDEX chat_email_digest_cooldown ON chat_email_digests(participant_id,sent_at)`);
    await q.query(`CREATE UNIQUE INDEX chat_email_digest_one_pending ON chat_email_digests(participant_id,channel_id) WHERE status = 'queued'`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE chat_email_digests`);
    await q.query(`ALTER TABLE chat_channels DROP COLUMN email_notifications_start_at`);
  }
}
