import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMentorClaimSystem1723334400000 implements MigrationInterface {
  name = "AddMentorClaimSystem1723334400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to mentors table
    await queryRunner.query(`
      ALTER TABLE "mentors"
      ADD COLUMN IF NOT EXISTS "capabilities" jsonb DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS "google_calendar_id" varchar,
      ADD COLUMN IF NOT EXISTS "max_claims" integer DEFAULT 3
    `);

    // Create mentor_claim_status enum
    await queryRunner.query(`
      CREATE TYPE "public"."mentor_claims_status_enum" AS ENUM(
        'active', 'expired', 'completed', 'released', 'swapped'
      )
    `);

    // Create mentor_claims table
    await queryRunner.query(`
      CREATE TABLE "mentor_claims" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentor_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "claimed_at" TIMESTAMP NOT NULL DEFAULT now(),
        "claimed_by" uuid NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "status" "public"."mentor_claims_status_enum" NOT NULL DEFAULT 'active',
        "session_count" integer NOT NULL DEFAULT 0,
        "swap_used" boolean NOT NULL DEFAULT false,
        "proposal_snapshot" jsonb,
        "released_at" TIMESTAMP,
        "release_reason" varchar,
        "previous_claim_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentor_claims" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mentor_claims_mentor_team" UNIQUE ("mentor_id", "team_id")
      )
    `);

    // Create indexes for mentor_claims
    await queryRunner.query(`CREATE INDEX "IDX_mentor_claims_mentor" ON "mentor_claims" ("mentor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_claims_team" ON "mentor_claims" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_claims_status" ON "mentor_claims" ("status")`);

    // Create scheduled_session_status enum
    await queryRunner.query(`
      CREATE TYPE "public"."scheduled_sessions_status_enum" AS ENUM(
        'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'
      )
    `);

    // Create scheduled_sessions table
    await queryRunner.query(`
      CREATE TABLE "scheduled_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "claim_id" uuid NOT NULL,
        "mentor_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "session_number" integer NOT NULL,
        "scheduled_at" TIMESTAMP NOT NULL,
        "duration_minutes" integer NOT NULL DEFAULT 45,
        "question" text NOT NULL,
        "status" "public"."scheduled_sessions_status_enum" NOT NULL DEFAULT 'scheduled',
        "google_event_id" varchar,
        "google_meet_link" varchar,
        "booked_by" uuid NOT NULL,
        "booked_at" TIMESTAMP NOT NULL DEFAULT now(),
        "confirmed_by_mentor" boolean NOT NULL DEFAULT false,
        "confirmed_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "cancelled_at" TIMESTAMP,
        "cancel_reason" varchar,
        "cancelled_by" varchar,
        "notes" text,
        "action_items" jsonb DEFAULT '[]',
        "mentor_feedback" text,
        "team_feedback" text,
        "rating" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scheduled_sessions" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for scheduled_sessions
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_sessions_claim" ON "scheduled_sessions" ("claim_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_sessions_mentor" ON "scheduled_sessions" ("mentor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_sessions_team" ON "scheduled_sessions" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_sessions_scheduled_at" ON "scheduled_sessions" ("scheduled_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_sessions_google_event" ON "scheduled_sessions" ("google_event_id")`);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "mentor_claims"
      ADD CONSTRAINT "FK_mentor_claims_mentor" FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE,
      ADD CONSTRAINT "FK_mentor_claims_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions"
      ADD CONSTRAINT "FK_scheduled_sessions_claim" FOREIGN KEY ("claim_id") REFERENCES "mentor_claims"("id") ON DELETE CASCADE,
      ADD CONSTRAINT "FK_scheduled_sessions_mentor" FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE,
      ADD CONSTRAINT "FK_scheduled_sessions_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "scheduled_sessions" DROP CONSTRAINT IF EXISTS "FK_scheduled_sessions_team"`);
    await queryRunner.query(`ALTER TABLE "scheduled_sessions" DROP CONSTRAINT IF EXISTS "FK_scheduled_sessions_mentor"`);
    await queryRunner.query(`ALTER TABLE "scheduled_sessions" DROP CONSTRAINT IF EXISTS "FK_scheduled_sessions_claim"`);
    await queryRunner.query(`ALTER TABLE "mentor_claims" DROP CONSTRAINT IF EXISTS "FK_mentor_claims_team"`);
    await queryRunner.query(`ALTER TABLE "mentor_claims" DROP CONSTRAINT IF EXISTS "FK_mentor_claims_mentor"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_sessions_google_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_sessions_scheduled_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_sessions_team"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_sessions_mentor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_sessions_claim"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_claims_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_claims_team"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_claims_mentor"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mentor_claims"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."scheduled_sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."mentor_claims_status_enum"`);

    // Remove columns from mentors table
    await queryRunner.query(`
      ALTER TABLE "mentors"
      DROP COLUMN IF EXISTS "capabilities",
      DROP COLUMN IF EXISTS "google_calendar_id",
      DROP COLUMN IF EXISTS "max_claims"
    `);
  }
}
