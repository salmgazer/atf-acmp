import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParticipantPreferences1720540800000
  implements MigrationInterface
{
  name = "AddParticipantPreferences1720540800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add status enum to participants table
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "participant_status_enum" AS ENUM (
          'imported', 'active', 'onboarding', 'ready', 'assigned', 'inactive'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to participants table
    await queryRunner.query(`
      ALTER TABLE "participants" 
      ADD COLUMN IF NOT EXISTS "interests" jsonb DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS "status" "participant_status_enum" DEFAULT 'imported'
    `);

    // Create index on participants status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_participants_cohort_status" 
      ON "participants" ("cohort_id", "status")
    `);

    // Create participant_preferences table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "participant_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "participant_id" uuid NOT NULL UNIQUE,
        "vertical_id_1" uuid,
        "vertical_id_2" uuid,
        "brief_rankings" jsonb DEFAULT '[]',
        "cross_country_willing" boolean DEFAULT true,
        "preferred_role" varchar,
        "availability_notes" text,
        "preferences_updated_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "FK_participant_preferences_participant" 
          FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_participant_preferences_vertical1" 
          FOREIGN KEY ("vertical_id_1") REFERENCES "verticals"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_participant_preferences_vertical2" 
          FOREIGN KEY ("vertical_id_2") REFERENCES "verticals"("id") ON DELETE SET NULL
      )
    `);

    // Create index on participant_preferences
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_participant_preferences_participant" 
      ON "participant_preferences" ("participant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop participant_preferences table
    await queryRunner.query(`DROP TABLE IF EXISTS "participant_preferences"`);

    // Remove columns from participants
    await queryRunner.query(`
      ALTER TABLE "participants" 
      DROP COLUMN IF EXISTS "interests",
      DROP COLUMN IF EXISTS "status"
    `);

    // Drop enum
    await queryRunner.query(`DROP TYPE IF EXISTS "participant_status_enum"`);
  }
}
