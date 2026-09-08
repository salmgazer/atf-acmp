import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPeerReviews1721404800000 implements MigrationInterface {
  name = "AddPeerReviews1721404800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create peer_review_assignment_status enum
    await queryRunner.query(`
      CREATE TYPE "peer_review_assignment_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'skipped')
    `);

    // Create peer_review_assignments table
    await queryRunner.query(`
      CREATE TABLE "peer_review_assignments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "stage_id" uuid NOT NULL REFERENCES "stages"("id") ON DELETE CASCADE,
        "reviewer_team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "reviewed_team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "status" "peer_review_assignment_status_enum" NOT NULL DEFAULT 'pending',
        "due_date" timestamp NOT NULL,
        "assigned_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("reviewer_team_id", "reviewed_team_id", "stage_id")
      )
    `);

    // Create peer_reviews table
    await queryRunner.query(`
      CREATE TABLE "peer_reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL REFERENCES "peer_review_assignments"("id") ON DELETE CASCADE,
        "reviewer_participant_id" uuid NOT NULL REFERENCES "participants"("id"),
        "scores" jsonb NOT NULL,
        "overall_score" decimal(5,2) NOT NULL,
        "overall_comment" text,
        "strengths" jsonb,
        "improvements" jsonb,
        "is_anonymous" boolean NOT NULL DEFAULT true,
        "submitted_at" timestamp NOT NULL,
        "time_spent_minutes" integer,
        "is_flagged" boolean NOT NULL DEFAULT false,
        "flag_reason" varchar,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create peer_review_rubrics table
    await queryRunner.query(`
      CREATE TABLE "peer_review_rubrics" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "stage_id" uuid REFERENCES "stages"("id") ON DELETE SET NULL,
        "name" varchar NOT NULL,
        "description" text,
        "criteria" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_peer_review_assignments_cohort_stage" ON "peer_review_assignments" ("cohort_id", "stage_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_peer_review_assignments_reviewer_status" ON "peer_review_assignments" ("reviewer_team_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_peer_review_assignments_reviewed" ON "peer_review_assignments" ("reviewed_team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_peer_reviews_assignment" ON "peer_reviews" ("assignment_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_peer_reviews_submitted" ON "peer_reviews" ("submitted_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_peer_review_rubrics_cohort_stage" ON "peer_review_rubrics" ("cohort_id", "stage_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_peer_review_rubrics_cohort_stage"`);
    await queryRunner.query(`DROP INDEX "IDX_peer_reviews_submitted"`);
    await queryRunner.query(`DROP INDEX "IDX_peer_reviews_assignment"`);
    await queryRunner.query(`DROP INDEX "IDX_peer_review_assignments_reviewed"`);
    await queryRunner.query(`DROP INDEX "IDX_peer_review_assignments_reviewer_status"`);
    await queryRunner.query(`DROP INDEX "IDX_peer_review_assignments_cohort_stage"`);
    await queryRunner.query(`DROP TABLE "peer_review_rubrics"`);
    await queryRunner.query(`DROP TABLE "peer_reviews"`);
    await queryRunner.query(`DROP TABLE "peer_review_assignments"`);
    await queryRunner.query(`DROP TYPE "peer_review_assignment_status_enum"`);
  }
}
