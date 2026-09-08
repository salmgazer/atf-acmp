import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationSystem1720972800000 implements MigrationInterface {
  name = "AddNotificationSystem1720972800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'team_invitation', 'team_invitation_accepted', 'team_invitation_declined',
        'team_member_joined', 'team_member_left',
        'mentor_assigned', 'mentor_session_scheduled', 'mentor_session_reminder',
        'brief_status_changed', 'brief_selected',
        'submission_received', 'submission_deadline', 'evaluation_complete',
        'chat_message', 'chat_mention',
        'forum_reply', 'forum_mention', 'forum_thread_reply',
        'announcement', 'deadline_reminder', 'system_alert'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_recipient_type_enum" AS ENUM (
        'user', 'participant', 'mentor', 'organization'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_priority_enum" AS ENUM (
        'low', 'normal', 'high', 'urgent'
      )
    `);

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "recipient_id" uuid NOT NULL,
        "recipient_type" "notification_recipient_type_enum" NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "summary" text,
        "data" jsonb,
        "action_url" character varying,
        "icon_name" character varying,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMP,
        "priority" "notification_priority_enum" NOT NULL DEFAULT 'normal',
        "email_sent" boolean NOT NULL DEFAULT false,
        "email_sent_at" TIMESTAMP,
        "push_sent" boolean NOT NULL DEFAULT false,
        "push_sent_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "group_key" character varying,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "user_type" "notification_recipient_type_enum" NOT NULL,
        "in_app_enabled" boolean NOT NULL DEFAULT true,
        "email_enabled" boolean NOT NULL DEFAULT true,
        "push_enabled" boolean NOT NULL DEFAULT true,
        "type_settings" jsonb,
        "quiet_hours_start" character varying,
        "quiet_hours_end" character varying,
        "timezone" character varying,
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_user" UNIQUE ("user_id", "user_type")
      )
    `);

    // Create push_tokens table
    await queryRunner.query(`
      CREATE TABLE "push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "user_type" "notification_recipient_type_enum" NOT NULL,
        "token" character varying NOT NULL,
        "device_type" character varying,
        "device_name" character varying,
        "last_active_at" TIMESTAMP NOT NULL DEFAULT now(),
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_push_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_tokens_token" UNIQUE ("token")
      )
    `);

    // Create indexes for notifications
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_read_created" 
      ON "notifications" ("recipient_id", "recipient_type", "is_read", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_created" 
      ON "notifications" ("recipient_id", "recipient_type", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_type_created" 
      ON "notifications" ("type", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_group_key" 
      ON "notifications" ("group_key") WHERE "group_key" IS NOT NULL
    `);

    // Create indexes for push_tokens
    await queryRunner.query(`
      CREATE INDEX "IDX_push_tokens_user" 
      ON "push_tokens" ("user_id", "user_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_push_tokens_user"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_group_key"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_type_created"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_created"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_read_created"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "push_tokens"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notifications"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "notification_priority_enum"`);
    await queryRunner.query(`DROP TYPE "notification_recipient_type_enum"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
  }
}
