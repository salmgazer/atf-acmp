import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBriefRevisionTracking1789400000000 implements MigrationInterface {
  name = "AddBriefRevisionTracking1789400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add actor_type enum to brief_revisions (check if exists first)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "brief_revision_actor_type_enum" AS ENUM ('organization', 'staff', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to brief_revisions (use IF NOT EXISTS)
    await queryRunner.query(`
      ALTER TABLE "brief_revisions" 
      ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "actor_type" "brief_revision_actor_type_enum"
    `);

    // Add RESTORED to brief_revisions action enum
    await queryRunner.query(`
      ALTER TYPE "brief_revisions_action_enum" ADD VALUE IF NOT EXISTS 'restored'
    `);

    // Add current_version to briefs (use IF NOT EXISTS)
    await queryRunner.query(`
      ALTER TABLE "briefs" 
      ADD COLUMN IF NOT EXISTS "current_version" INTEGER DEFAULT 1
    `);

    // Update existing brief_revisions to have version numbers based on creation order
    await queryRunner.query(`
      WITH numbered_revisions AS (
        SELECT id, brief_id, 
               ROW_NUMBER() OVER (PARTITION BY brief_id ORDER BY created_at ASC) as row_num
        FROM brief_revisions
      )
      UPDATE brief_revisions br
      SET version = nr.row_num
      FROM numbered_revisions nr
      WHERE br.id = nr.id AND br.version IS NULL
    `);

    // Update briefs current_version to match their latest revision
    await queryRunner.query(`
      UPDATE briefs b
      SET current_version = COALESCE(
        (SELECT MAX(version) FROM brief_revisions WHERE brief_id = b.id),
        1
      )
      WHERE current_version IS NULL OR current_version = 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove current_version from briefs
    await queryRunner.query(`
      ALTER TABLE "briefs" 
      DROP COLUMN IF EXISTS "current_version"
    `);

    // Remove columns from brief_revisions
    await queryRunner.query(`
      ALTER TABLE "brief_revisions" 
      DROP COLUMN IF EXISTS "version",
      DROP COLUMN IF EXISTS "actor_type"
    `);

    // Drop the actor_type enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS "brief_revision_actor_type_enum"
    `);

    // Note: Cannot easily remove 'restored' from enum in PostgreSQL
    // It will remain but be unused after rollback
  }
}
