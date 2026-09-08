import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMentorSystem1720713600000 implements MigrationInterface {
  name = "AddMentorSystem1720713600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create mentor status enum
    await queryRunner.query(`
      CREATE TYPE "mentor_status_enum" AS ENUM ('imported', 'active', 'inactive')
    `);

    // Create mentors table
    await queryRunner.query(`
      CREATE TABLE "mentors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "phone" character varying,
        "company" character varying,
        "title" character varying,
        "bio" text,
        "profile_image_url" character varying,
        "expertise" jsonb NOT NULL DEFAULT '[]',
        "calendly_link" character varying,
        "linkedin_url" character varying,
        "max_teams" integer NOT NULL DEFAULT 3,
        "vertical_scope" jsonb NOT NULL DEFAULT '[]',
        "firebase_uid" character varying,
        "status" "mentor_status_enum" NOT NULL DEFAULT 'imported',
        "cohort_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "UQ_mentors_email" UNIQUE ("email"),
        CONSTRAINT "PK_mentors" PRIMARY KEY ("id")
      )
    `);

    // Create mentor_assignments table
    await queryRunner.query(`
      CREATE TABLE "mentor_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentor_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "assigned_at" TIMESTAMP NOT NULL DEFAULT now(),
        "assigned_by" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "unassigned_at" TIMESTAMP,
        "unassign_reason" character varying,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "UQ_mentor_team" UNIQUE ("mentor_id", "team_id"),
        CONSTRAINT "PK_mentor_assignments" PRIMARY KEY ("id")
      )
    `);

    // Create mentor_sessions table
    await queryRunner.query(`
      CREATE TABLE "mentor_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentor_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "session_date" TIMESTAMP NOT NULL,
        "duration_minutes" integer NOT NULL,
        "notes" text,
        "topics_discussed" jsonb NOT NULL DEFAULT '[]',
        "action_items" jsonb NOT NULL DEFAULT '[]',
        "team_progress_notes" text,
        "next_session_goals" text,
        "session_type" character varying NOT NULL DEFAULT 'regular',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_mentor_sessions" PRIMARY KEY ("id")
      )
    `);

    // Add indexes
    await queryRunner.query(`CREATE INDEX "IDX_mentors_cohort_status" ON "mentors" ("cohort_id", "status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_mentors_email" ON "mentors" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_assignments_mentor" ON "mentor_assignments" ("mentor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_assignments_team" ON "mentor_assignments" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_sessions_mentor" ON "mentor_sessions" ("mentor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_sessions_team" ON "mentor_sessions" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mentor_sessions_date" ON "mentor_sessions" ("session_date")`);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "mentors"
      ADD CONSTRAINT "FK_mentors_cohort"
      FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "mentor_assignments"
      ADD CONSTRAINT "FK_mentor_assignments_mentor"
      FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "mentor_assignments"
      ADD CONSTRAINT "FK_mentor_assignments_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "mentor_sessions"
      ADD CONSTRAINT "FK_mentor_sessions_mentor"
      FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "mentor_sessions"
      ADD CONSTRAINT "FK_mentor_sessions_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
    `);

    // Add mentor_id column to teams table for quick reference
    await queryRunner.query(`
      ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "mentor_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD CONSTRAINT "FK_teams_mentor"
      FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key from teams
    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "FK_teams_mentor"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN IF EXISTS "mentor_id"`);

    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "mentor_sessions" DROP CONSTRAINT "FK_mentor_sessions_team"`);
    await queryRunner.query(`ALTER TABLE "mentor_sessions" DROP CONSTRAINT "FK_mentor_sessions_mentor"`);
    await queryRunner.query(`ALTER TABLE "mentor_assignments" DROP CONSTRAINT "FK_mentor_assignments_team"`);
    await queryRunner.query(`ALTER TABLE "mentor_assignments" DROP CONSTRAINT "FK_mentor_assignments_mentor"`);
    await queryRunner.query(`ALTER TABLE "mentors" DROP CONSTRAINT "FK_mentors_cohort"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_mentor_sessions_date"`);
    await queryRunner.query(`DROP INDEX "IDX_mentor_sessions_team"`);
    await queryRunner.query(`DROP INDEX "IDX_mentor_sessions_mentor"`);
    await queryRunner.query(`DROP INDEX "IDX_mentor_assignments_team"`);
    await queryRunner.query(`DROP INDEX "IDX_mentor_assignments_mentor"`);
    await queryRunner.query(`DROP INDEX "IDX_mentors_email"`);
    await queryRunner.query(`DROP INDEX "IDX_mentors_cohort_status"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "mentor_sessions"`);
    await queryRunner.query(`DROP TABLE "mentor_assignments"`);
    await queryRunner.query(`DROP TABLE "mentors"`);

    // Drop enum
    await queryRunner.query(`DROP TYPE "mentor_status_enum"`);
  }
}
