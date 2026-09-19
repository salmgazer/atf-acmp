import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBriefPriorityScore1790000300000 implements MigrationInterface {
  name = "AddBriefPriorityScore1790000300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add priority_score column to briefs table
    await queryRunner.query(`
      ALTER TABLE "briefs"
      ADD COLUMN IF NOT EXISTS "priority_score" integer DEFAULT 0
    `);

    // Create index for efficient sorting by priority
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_briefs_priority_score" ON "briefs" ("priority_score" DESC NULLS LAST)
    `);

    // Update existing briefs with calculated priority scores based on existing scoring data
    // Priority = fitScore + (impactScore * 10) - (50 if has override)
    await queryRunner.query(`
      UPDATE "briefs"
      SET "priority_score" = COALESCE("fit_score", 0) 
        + (COALESCE("impact_score", 0) * 10)
        - (CASE WHEN "score_override" IS NOT NULL THEN 50 ELSE 0 END)
      WHERE "scoring_answers" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_briefs_priority_score"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "priority_score"`);
  }
}
