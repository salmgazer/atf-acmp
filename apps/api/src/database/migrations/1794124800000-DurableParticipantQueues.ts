import { MigrationInterface, QueryRunner } from "typeorm";

export class DurableParticipantQueues1794124800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE participant_invite_batches (
      id varchar(150) PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      requested_by uuid NOT NULL CONSTRAINT participant_invite_batches_requested_by_fkey REFERENCES users(id),
      participant_ids uuid[] NOT NULL, state varchar NOT NULL DEFAULT 'queued', progress jsonb NOT NULL, error text,
      CONSTRAINT participant_invite_batch_state_check CHECK (state IN ('queued','active','completed','failed')),
      CONSTRAINT participant_invite_batch_recipients_check CHECK (cardinality(participant_ids) > 0)
    )`);
    await q.query(`CREATE INDEX participant_invite_batch_state_created ON participant_invite_batches(state,created_at)`);
    await q.query(`CREATE INDEX participant_import_batch_recovery ON participant_import_batches(state,created_at) WHERE deleted_at IS NULL`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX participant_import_batch_recovery`);
    await q.query(`DROP TABLE participant_invite_batches`);
  }
}
