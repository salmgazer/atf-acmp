import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMentorSessionRates1790000000000 implements MigrationInterface {
  name = "AddMentorSessionRates1790000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add session_rate column to cohorts table (default rate per session)
    await queryRunner.query(`
      ALTER TABLE "cohorts" 
      ADD COLUMN IF NOT EXISTS "session_rate" DECIMAL(10, 2) NOT NULL DEFAULT 0
    `);

    // Add session_rate_override column to mentors table (nullable, per-mentor override)
    await queryRunner.query(`
      ALTER TABLE "mentors" 
      ADD COLUMN IF NOT EXISTS "session_rate_override" DECIMAL(10, 2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove session_rate_override from mentors
    await queryRunner.query(`
      ALTER TABLE "mentors" 
      DROP COLUMN IF EXISTS "session_rate_override"
    `);

    // Remove session_rate from cohorts
    await queryRunner.query(`
      ALTER TABLE "cohorts" 
      DROP COLUMN IF EXISTS "session_rate"
    `);
  }
}
