import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeaderboardConfig1721492400000 implements MigrationInterface {
  name = "AddLeaderboardConfig1721492400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cohorts"
      ADD COLUMN IF NOT EXISTS "leaderboard_config" jsonb DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cohorts"
      DROP COLUMN IF EXISTS "leaderboard_config"
    `);
  }
}
