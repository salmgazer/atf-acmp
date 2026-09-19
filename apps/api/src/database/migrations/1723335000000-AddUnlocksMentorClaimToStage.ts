import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUnlocksMentorClaimToStage1723335000000 implements MigrationInterface {
  name = "AddUnlocksMentorClaimToStage1723335000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stages"
      ADD COLUMN IF NOT EXISTS "unlocks_mentor_claim" boolean DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stages"
      DROP COLUMN IF EXISTS "unlocks_mentor_claim"
    `);
  }
}
