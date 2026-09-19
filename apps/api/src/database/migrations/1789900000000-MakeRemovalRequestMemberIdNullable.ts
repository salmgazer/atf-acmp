import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeRemovalRequestMemberIdNullable1789900000000 implements MigrationInterface {
  name = "MakeRemovalRequestMemberIdNullable1789900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists first
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'team_member_removal_requests'
      )
    `);

    if (!tableExists[0].exists) {
      return; // Table doesn't exist, skip this migration
    }

    // Drop the existing foreign key constraint (find the actual constraint name first)
    const constraints = await queryRunner.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'team_member_removal_requests' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%member_id%'
    `);

    for (const constraint of constraints) {
      await queryRunner.query(`
        ALTER TABLE "team_member_removal_requests" 
        DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}"
      `);
    }

    // Make the member_id column nullable (idempotent - won't fail if already nullable)
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" 
      ALTER COLUMN "member_id" DROP NOT NULL
    `);

    // Re-add the foreign key with ON DELETE SET NULL (idempotent)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "team_member_removal_requests" 
        ADD CONSTRAINT "FK_removal_request_member" 
        FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" 
      DROP CONSTRAINT IF EXISTS "FK_removal_request_member"
    `);

    // Delete any rows with NULL member_id before making it NOT NULL
    await queryRunner.query(`
      DELETE FROM "team_member_removal_requests" WHERE "member_id" IS NULL
    `);

    // Make the member_id column NOT NULL
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" 
      ALTER COLUMN "member_id" SET NOT NULL
    `);

    // Re-add the foreign key with ON DELETE CASCADE
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "team_member_removal_requests" 
        ADD CONSTRAINT "FK_removal_request_member" 
        FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }
}
