import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMentorSessionDeclineWorkflow1789700000000 implements MigrationInterface {
  name = "AddMentorSessionDeclineWorkflow1789700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add 'declined' value to scheduled_session_status enum
    await queryRunner.query(`
      ALTER TYPE "public"."scheduled_sessions_status_enum" 
      ADD VALUE IF NOT EXISTS 'declined'
    `);

    // 2. Add declined_at column to scheduled_sessions
    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions" 
      ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMP
    `);

    // 3. Add decline_reason column to scheduled_sessions
    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions" 
      ADD COLUMN IF NOT EXISTS "decline_reason" character varying
    `);

    // 4. Add new notification types to notification_type enum
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" 
      ADD VALUE IF NOT EXISTS 'mentor_session_requested'
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" 
      ADD VALUE IF NOT EXISTS 'mentor_session_confirmed'
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" 
      ADD VALUE IF NOT EXISTS 'mentor_session_declined'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing values from enums easily
    // You would need to recreate the enum without the values
    // For this migration, we'll just drop the columns

    // Drop decline_reason column
    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions" 
      DROP COLUMN IF EXISTS "decline_reason"
    `);

    // Drop declined_at column
    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions" 
      DROP COLUMN IF EXISTS "declined_at"
    `);

    // Note: Cannot easily remove enum values in PostgreSQL
    // The 'declined' status and notification types will remain in the enums
  }
}
