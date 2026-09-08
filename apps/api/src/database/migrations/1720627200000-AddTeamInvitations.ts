import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamInvitations1720627200000 implements MigrationInterface {
  name = "AddTeamInvitations1720627200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create invitation status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invitation_status_enum" AS ENUM (
          'pending', 'accepted', 'declined', 'expired', 'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to teams table
    await queryRunner.query(`
      ALTER TABLE "teams" 
      ADD COLUMN IF NOT EXISTS "disqualification_reason" text,
      ADD COLUMN IF NOT EXISTS "disqualified_at" timestamp,
      ADD COLUMN IF NOT EXISTS "disqualified_by" uuid
    `);

    // Create team_invitations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_invitations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL,
        "participant_id" uuid NOT NULL,
        "invited_by" uuid NOT NULL,
        "status" "invitation_status_enum" DEFAULT 'pending',
        "message" text,
        "invited_at" timestamp DEFAULT now(),
        "responded_at" timestamp,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "FK_team_invitations_team" 
          FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_participant" 
          FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_inviter" 
          FOREIGN KEY ("invited_by") REFERENCES "participants"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_team_invitations_team" ON "team_invitations" ("team_id");
      CREATE INDEX IF NOT EXISTS "IDX_team_invitations_participant" ON "team_invitations" ("participant_id");
      CREATE INDEX IF NOT EXISTS "IDX_team_invitations_status" ON "team_invitations" ("status");
    `);

    // Add unique constraint for team members (PostgreSQL doesn't support IF NOT EXISTS for constraints)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "team_members" 
        ADD CONSTRAINT "UQ_team_members_team_participant" 
        UNIQUE ("team_id", "participant_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add foreign key for participant in team_members
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "team_members" 
        ADD CONSTRAINT "FK_team_members_participant" 
        FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add foreign key for brief in teams
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "teams" 
        ADD CONSTRAINT "FK_teams_brief" 
        FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`
      ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "FK_teams_brief";
      ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "FK_team_members_participant";
      ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "UQ_team_members_team_participant";
    `);

    // Drop team_invitations table
    await queryRunner.query(`DROP TABLE IF EXISTS "team_invitations"`);

    // Remove columns from teams
    await queryRunner.query(`
      ALTER TABLE "teams" 
      DROP COLUMN IF EXISTS "disqualification_reason",
      DROP COLUMN IF EXISTS "disqualified_at",
      DROP COLUMN IF EXISTS "disqualified_by"
    `);

    // Drop enum
    await queryRunner.query(`DROP TYPE IF EXISTS "invitation_status_enum"`);
  }
}
