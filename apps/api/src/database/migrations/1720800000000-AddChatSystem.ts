import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatSystem1720800000000 implements MigrationInterface {
  name = "AddChatSystem1720800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "channel_type_enum" AS ENUM ('team', 'mentor_team', 'staff', 'announcement', 'direct')
    `);

    await queryRunner.query(`
      CREATE TYPE "sender_type_enum" AS ENUM ('participant', 'mentor', 'staff', 'organization', 'system')
    `);

    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM ('text', 'image', 'file', 'system')
    `);

    // Create chat_channels table
    await queryRunner.query(`
      CREATE TABLE "chat_channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "type" "channel_type_enum" NOT NULL,
        "cohort_id" uuid,
        "team_id" uuid,
        "is_private" boolean NOT NULL DEFAULT false,
        "is_archived" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_chat_channels" PRIMARY KEY ("id")
      )
    `);

    // Create chat_messages table
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "sender_id" character varying NOT NULL,
        "sender_type" "sender_type_enum" NOT NULL,
        "sender_name" character varying NOT NULL,
        "sender_avatar_url" character varying,
        "content" text NOT NULL,
        "message_type" "message_type_enum" NOT NULL DEFAULT 'text',
        "attachment_url" character varying,
        "attachment_name" character varying,
        "attachment_size" integer,
        "attachment_mime_type" character varying,
        "reply_to_id" uuid,
        "is_edited" boolean NOT NULL DEFAULT false,
        "edited_at" TIMESTAMP,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id")
      )
    `);

    // Create channel_members table
    await queryRunner.query(`
      CREATE TABLE "channel_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "member_id" character varying NOT NULL,
        "member_type" "sender_type_enum" NOT NULL,
        "member_name" character varying NOT NULL,
        "member_avatar_url" character varying,
        "last_read_at" TIMESTAMP,
        "last_read_message_id" uuid,
        "is_admin" boolean NOT NULL DEFAULT false,
        "is_muted" boolean NOT NULL DEFAULT false,
        "muted_until" TIMESTAMP,
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        "left_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_channel_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_channel_member" UNIQUE ("channel_id", "member_id", "member_type")
      )
    `);

    // Create message_reactions table
    await queryRunner.query(`
      CREATE TABLE "message_reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "reactor_id" character varying NOT NULL,
        "reactor_type" "sender_type_enum" NOT NULL,
        "emoji" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_message_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_message_reaction" UNIQUE ("message_id", "reactor_id", "reactor_type", "emoji")
      )
    `);

    // Create typing_indicators table (ephemeral)
    await queryRunner.query(`
      CREATE TABLE "typing_indicators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "user_id" character varying NOT NULL,
        "user_type" "sender_type_enum" NOT NULL,
        "user_name" character varying NOT NULL,
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_typing_indicators" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_chat_channels_cohort_type" ON "chat_channels" ("cohort_id", "type")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_channels_team" ON "chat_channels" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_channel_created" ON "chat_messages" ("channel_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_sender" ON "chat_messages" ("sender_id", "sender_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_channel_members_channel" ON "channel_members" ("channel_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_channel_members_member" ON "channel_members" ("member_id", "member_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_reactions_message" ON "message_reactions" ("message_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_typing_indicators_channel" ON "typing_indicators" ("channel_id")`);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "chat_channels"
      ADD CONSTRAINT "FK_chat_channels_cohort"
      FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_channels"
      ADD CONSTRAINT "FK_chat_channels_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_channel"
      FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_reply_to"
      FOREIGN KEY ("reply_to_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "channel_members"
      ADD CONSTRAINT "FK_channel_members_channel"
      FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "message_reactions"
      ADD CONSTRAINT "FK_message_reactions_message"
      FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "message_reactions" DROP CONSTRAINT "FK_message_reactions_message"`);
    await queryRunner.query(`ALTER TABLE "channel_members" DROP CONSTRAINT "FK_channel_members_channel"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_chat_messages_reply_to"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_chat_messages_channel"`);
    await queryRunner.query(`ALTER TABLE "chat_channels" DROP CONSTRAINT "FK_chat_channels_team"`);
    await queryRunner.query(`ALTER TABLE "chat_channels" DROP CONSTRAINT "FK_chat_channels_cohort"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_typing_indicators_channel"`);
    await queryRunner.query(`DROP INDEX "IDX_message_reactions_message"`);
    await queryRunner.query(`DROP INDEX "IDX_channel_members_member"`);
    await queryRunner.query(`DROP INDEX "IDX_channel_members_channel"`);
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_sender"`);
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_channel_created"`);
    await queryRunner.query(`DROP INDEX "IDX_chat_channels_team"`);
    await queryRunner.query(`DROP INDEX "IDX_chat_channels_cohort_type"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "typing_indicators"`);
    await queryRunner.query(`DROP TABLE "message_reactions"`);
    await queryRunner.query(`DROP TABLE "channel_members"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TABLE "chat_channels"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "message_type_enum"`);
    await queryRunner.query(`DROP TYPE "sender_type_enum"`);
    await queryRunner.query(`DROP TYPE "channel_type_enum"`);
  }
}
