import { MigrationInterface, QueryRunner } from "typeorm";

export class BuilderBroadcasts1795651200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE builder_broadcasts (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      requested_by uuid NOT NULL REFERENCES users(id), filters jsonb NOT NULL, audience_hash varchar(64) NOT NULL,
      subject varchar(200) NOT NULL, message text NOT NULL, recipients jsonb NOT NULL,
      state varchar NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','active','completed','failed')),
      progress jsonb NOT NULL, CHECK (jsonb_typeof(recipients) = 'array' AND jsonb_array_length(recipients) > 0)
    )`);
    await q.query(`CREATE INDEX builder_broadcast_state_created ON builder_broadcasts(state, created_at)`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE builder_broadcasts`); }
}
