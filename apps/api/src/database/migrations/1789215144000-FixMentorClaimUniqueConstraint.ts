import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMentorClaimUniqueConstraint1789215144000 implements MigrationInterface {
  name = "FixMentorClaimUniqueConstraint1789215144000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing unique constraint that prevents re-claiming
    // The constraint name may vary - try both possible names
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_8438faff4df1279a6625cf9166"
    `);
    
    await queryRunner.query(`
      DROP INDEX IF EXISTS "mentor_claims_mentor_id_team_id_key"
    `);

    // Create a partial unique index that only applies to active claims
    // This allows a team to have multiple claim records for the same mentor
    // as long as only one is active at a time
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_mentor_claims_active_unique" 
      ON "mentor_claims" ("mentor_id", "team_id") 
      WHERE status = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the partial unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mentor_claims_active_unique"
    `);

    // Restore the original unique constraint
    // Note: This may fail if there are duplicate mentor_id/team_id pairs
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_8438faff4df1279a6625cf9166" 
      ON "mentor_claims" ("mentor_id", "team_id")
    `);
  }
}
