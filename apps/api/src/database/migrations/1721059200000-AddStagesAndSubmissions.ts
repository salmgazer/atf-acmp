import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStagesAndSubmissions1721059200000 implements MigrationInterface {
  name = "AddStagesAndSubmissions1721059200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create stage_type enum
    await queryRunner.query(`
      CREATE TYPE "stage_type_enum" AS ENUM ('document', 'video', 'url', 'mixed')
    `);

    // Create submission_status enum
    await queryRunner.query(`
      CREATE TYPE "submission_status_enum" AS ENUM ('draft', 'submitted', 'late', 'evaluated')
    `);

    // Create stages table
    await queryRunner.query(`
      CREATE TABLE "stages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "number" integer NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "instructions" text,
        "type" "stage_type_enum" NOT NULL DEFAULT 'mixed',
        "start_date" timestamp,
        "deadline" timestamp NOT NULL,
        "requirements" jsonb NOT NULL DEFAULT '{}',
        "weight_percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "allow_late_submissions" boolean NOT NULL DEFAULT true,
        "late_penalty_percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create submissions table
    await queryRunner.query(`
      CREATE TABLE "submissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "stage_id" uuid NOT NULL REFERENCES "stages"("id") ON DELETE CASCADE,
        "status" "submission_status_enum" NOT NULL DEFAULT 'draft',
        "content" jsonb NOT NULL DEFAULT '{}',
        "file_urls" jsonb NOT NULL DEFAULT '[]',
        "github_url" varchar,
        "video_url" varchar,
        "submitted_at" timestamp,
        "submitted_by" uuid REFERENCES "participants"("id"),
        "is_late" boolean NOT NULL DEFAULT false,
        "late_minutes" integer NOT NULL DEFAULT 0,
        "score" decimal(5,2),
        "evaluated_at" timestamp,
        "evaluated_by" uuid REFERENCES "users"("id"),
        "evaluation_notes" text,
        "feedback" jsonb,
        "version" integer NOT NULL DEFAULT 1,
        "last_saved_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("team_id", "stage_id")
      )
    `);

    // Create submission_history table
    await queryRunner.query(`
      CREATE TABLE "submission_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "content" jsonb NOT NULL,
        "file_urls" jsonb NOT NULL DEFAULT '[]',
        "github_url" varchar,
        "video_url" varchar,
        "saved_by" uuid NOT NULL REFERENCES "participants"("id"),
        "saved_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_stages_cohort_number" ON "stages" ("cohort_id", "number")`);
    await queryRunner.query(`CREATE INDEX "IDX_stages_cohort_active" ON "stages" ("cohort_id", "is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_submissions_stage_status" ON "submissions" ("stage_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_submissions_submitted_at" ON "submissions" ("submitted_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_submission_history_submission" ON "submission_history" ("submission_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_submission_history_saved_at" ON "submission_history" ("saved_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_submission_history_saved_at"`);
    await queryRunner.query(`DROP INDEX "IDX_submission_history_submission"`);
    await queryRunner.query(`DROP INDEX "IDX_submissions_submitted_at"`);
    await queryRunner.query(`DROP INDEX "IDX_submissions_stage_status"`);
    await queryRunner.query(`DROP INDEX "IDX_stages_cohort_active"`);
    await queryRunner.query(`DROP INDEX "IDX_stages_cohort_number"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "submission_history"`);
    await queryRunner.query(`DROP TABLE "submissions"`);
    await queryRunner.query(`DROP TABLE "stages"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "submission_status_enum"`);
    await queryRunner.query(`DROP TYPE "stage_type_enum"`);
  }
}
