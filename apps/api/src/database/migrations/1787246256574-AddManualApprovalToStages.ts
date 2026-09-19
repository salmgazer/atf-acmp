import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManualApprovalToStages1787246256574 implements MigrationInterface {
  name = "AddManualApprovalToStages1787246256574";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add requiresManualApproval to stages
    await queryRunner.query(`
      ALTER TABLE "stages" 
      ADD COLUMN IF NOT EXISTS "requires_manual_approval" boolean NOT NULL DEFAULT false
    `);

    // Add new submission statuses and approval fields
    // First, alter the enum type to add new values
    await queryRunner.query(`
      ALTER TYPE "public"."submissions_status_enum" ADD VALUE IF NOT EXISTS 'pending_approval'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."submissions_status_enum" ADD VALUE IF NOT EXISTS 'approved'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."submissions_status_enum" ADD VALUE IF NOT EXISTS 'rejected'
    `);

    // Add approval tracking columns to submissions
    await queryRunner.query(`
      ALTER TABLE "submissions"
      ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "approved_by" character varying,
      ADD COLUMN IF NOT EXISTS "approval_notes" text,
      ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "rejected_by" character varying,
      ADD COLUMN IF NOT EXISTS "rejection_reason" text
    `);

    // Add new notification types
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'submission_needs_approval'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'submission_approved'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'submission_rejected'
    `);

    // Create index for pending approvals
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_submissions_pending_approval" 
      ON "submissions" ("stage_id", "status") 
      WHERE status = 'pending_approval'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_pending_approval"`);

    // Remove columns from submissions
    await queryRunner.query(`
      ALTER TABLE "submissions"
      DROP COLUMN IF EXISTS "approved_at",
      DROP COLUMN IF EXISTS "approved_by",
      DROP COLUMN IF EXISTS "approval_notes",
      DROP COLUMN IF EXISTS "rejected_at",
      DROP COLUMN IF EXISTS "rejected_by",
      DROP COLUMN IF EXISTS "rejection_reason"
    `);

    // Remove column from stages
    await queryRunner.query(`
      ALTER TABLE "stages"
      DROP COLUMN IF EXISTS "requires_manual_approval"
    `);

    // Note: PostgreSQL doesn't support removing enum values easily
    // The enum values will remain but won't be used
  }
}
