import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEvaluations1721491200000 implements MigrationInterface {
  name = "AddEvaluations1721491200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create evaluation_job_status enum
    await queryRunner.query(`
      CREATE TYPE "evaluation_job_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled')
    `);

    // Create evaluations table
    await queryRunner.query(`
      CREATE TABLE "evaluations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "stage_id" uuid NOT NULL REFERENCES "stages"("id") ON DELETE CASCADE,
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "ai_scores" jsonb,
        "ai_overall_score" decimal(5,2),
        "ai_feedback" text,
        "ai_strengths" jsonb,
        "ai_improvements" jsonb,
        "human_scores" jsonb,
        "human_overall_score" decimal(5,2),
        "human_feedback" text,
        "final_score" decimal(5,2),
        "ai_weight" decimal(3,2) NOT NULL DEFAULT 0.4,
        "metrics" jsonb,
        "ai_evaluated_at" timestamp,
        "human_evaluated_at" timestamp,
        "human_evaluator_id" uuid,
        "is_published" boolean NOT NULL DEFAULT false,
        "published_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("team_id", "stage_id")
      )
    `);

    // Create evaluation_jobs table
    await queryRunner.query(`
      CREATE TABLE "evaluation_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "stage_id" uuid NOT NULL REFERENCES "stages"("id") ON DELETE CASCADE,
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "status" "evaluation_job_status_enum" NOT NULL DEFAULT 'pending',
        "progress" integer NOT NULL DEFAULT 0,
        "current_step" varchar,
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 3,
        "error" text,
        "error_stack" text,
        "bull_job_id" varchar,
        "started_at" timestamp,
        "completed_at" timestamp,
        "processing_time_ms" integer,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_evaluations_team_stage" ON "evaluations" ("team_id", "stage_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_evaluations_cohort_stage" ON "evaluations" ("cohort_id", "stage_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_evaluation_jobs_status" ON "evaluation_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_evaluation_jobs_team_stage" ON "evaluation_jobs" ("team_id", "stage_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_evaluation_jobs_created" ON "evaluation_jobs" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_evaluation_jobs_created"`);
    await queryRunner.query(`DROP INDEX "IDX_evaluation_jobs_team_stage"`);
    await queryRunner.query(`DROP INDEX "IDX_evaluation_jobs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_evaluations_cohort_stage"`);
    await queryRunner.query(`DROP INDEX "IDX_evaluations_team_stage"`);
    await queryRunner.query(`DROP TABLE "evaluation_jobs"`);
    await queryRunner.query(`DROP TABLE "evaluations"`);
    await queryRunner.query(`DROP TYPE "evaluation_job_status_enum"`);
  }
}
