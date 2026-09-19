import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamMemberApprovalWorkflow1789600000000 implements MigrationInterface {
  name = "AddTeamMemberApprovalWorkflow1789600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create team_member_status enum
    await queryRunner.query(`
      CREATE TYPE "team_member_status_enum" AS ENUM ('pending', 'confirmed')
    `);

    // Create removal_request_status enum
    await queryRunner.query(`
      CREATE TYPE "removal_request_status_enum" AS ENUM ('pending', 'approved', 'rejected')
    `);

    // Add status, confirmed_at, confirmed_by columns to team_members
    await queryRunner.query(`
      ALTER TABLE "team_members"
      ADD COLUMN "status" "team_member_status_enum" NOT NULL DEFAULT 'confirmed',
      ADD COLUMN "confirmed_at" TIMESTAMP,
      ADD COLUMN "confirmed_by" VARCHAR
    `);

    // Create index on team_members.status
    await queryRunner.query(`
      CREATE INDEX "IDX_team_members_status" ON "team_members" ("status")
    `);

    // Set confirmed_at for existing members (they are all confirmed)
    await queryRunner.query(`
      UPDATE "team_members"
      SET "confirmed_at" = "joined_at"
      WHERE "status" = 'confirmed'
    `);

    // Create team_member_removal_requests table
    await queryRunner.query(`
      CREATE TABLE "team_member_removal_requests" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "team_id" UUID NOT NULL,
        "member_id" UUID NOT NULL,
        "participant_id" UUID NOT NULL,
        "requested_by" UUID NOT NULL,
        "status" "removal_request_status_enum" NOT NULL DEFAULT 'pending',
        "reason" TEXT,
        "requested_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP,
        "resolved_by" VARCHAR,
        "resolution_notes" TEXT,
        CONSTRAINT "PK_team_member_removal_requests" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests"
      ADD CONSTRAINT "FK_removal_requests_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests"
      ADD CONSTRAINT "FK_removal_requests_member" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests"
      ADD CONSTRAINT "FK_removal_requests_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests"
      ADD CONSTRAINT "FK_removal_requests_requester" FOREIGN KEY ("requested_by") REFERENCES "participants"("id") ON DELETE NO ACTION
    `);

    // Create indexes on team_member_removal_requests
    await queryRunner.query(`
      CREATE INDEX "IDX_removal_requests_team_id" ON "team_member_removal_requests" ("team_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_removal_requests_member_id" ON "team_member_removal_requests" ("member_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_removal_requests_status" ON "team_member_removal_requests" ("status")
    `);

    // Add new notification types to the enum
    // Note: PostgreSQL allows adding values to enums but not removing them easily
    await queryRunner.query(`
      ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'team_join_request'
    `);

    await queryRunner.query(`
      ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'team_join_confirmed'
    `);

    await queryRunner.query(`
      ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'team_join_declined'
    `);

    await queryRunner.query(`
      ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'team_member_removal_requested'
    `);

    await queryRunner.query(`
      ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'team_member_removal_approved'
    `);

    await queryRunner.query(`
      ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'team_member_removal_rejected'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes on team_member_removal_requests
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_removal_requests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_removal_requests_member_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_removal_requests_team_id"`);

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" DROP CONSTRAINT IF EXISTS "FK_removal_requests_requester"
    `);
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" DROP CONSTRAINT IF EXISTS "FK_removal_requests_participant"
    `);
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" DROP CONSTRAINT IF EXISTS "FK_removal_requests_member"
    `);
    await queryRunner.query(`
      ALTER TABLE "team_member_removal_requests" DROP CONSTRAINT IF EXISTS "FK_removal_requests_team"
    `);

    // Drop team_member_removal_requests table
    await queryRunner.query(`DROP TABLE IF EXISTS "team_member_removal_requests"`);

    // Drop index on team_members.status
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_members_status"`);

    // Remove columns from team_members
    await queryRunner.query(`
      ALTER TABLE "team_members"
      DROP COLUMN IF EXISTS "confirmed_by",
      DROP COLUMN IF EXISTS "confirmed_at",
      DROP COLUMN IF EXISTS "status"
    `);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "removal_request_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_member_status_enum"`);

    // Note: Cannot easily remove values from notification_type_enum in PostgreSQL
    // The new notification types will remain but be unused after rollback
  }
}
