import { MigrationInterface, QueryRunner } from "typeorm";

export class AddForumSystem1720886400000 implements MigrationInterface {
  name = "AddForumSystem1720886400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for forum author types
    await queryRunner.query(`
      CREATE TYPE "forum_author_type_enum" AS ENUM ('participant', 'mentor', 'staff')
    `);

    // Create forum_categories table
    await queryRunner.query(`
      CREATE TABLE "forum_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "description" text,
        "cohort_id" uuid NOT NULL,
        "vertical_id" uuid,
        "icon_name" character varying,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "staff_only" boolean NOT NULL DEFAULT false,
        "is_locked" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_forum_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_categories_cohort" FOREIGN KEY ("cohort_id") 
          REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create forum_threads table
    await queryRunner.query(`
      CREATE TABLE "forum_threads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "category_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "author_id" uuid NOT NULL,
        "author_type" "forum_author_type_enum" NOT NULL,
        "author_name" character varying NOT NULL,
        "author_avatar_url" character varying,
        "is_pinned" boolean NOT NULL DEFAULT false,
        "is_locked" boolean NOT NULL DEFAULT false,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "deleted_by" uuid,
        "is_edited" boolean NOT NULL DEFAULT false,
        "edited_at" TIMESTAMP,
        "reply_count" integer NOT NULL DEFAULT 0,
        "last_reply_at" TIMESTAMP,
        "last_reply_author_name" character varying,
        "view_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_forum_threads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_threads_category" FOREIGN KEY ("category_id") 
          REFERENCES "forum_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create forum_replies table
    await queryRunner.query(`
      CREATE TABLE "forum_replies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "thread_id" uuid NOT NULL,
        "content" text NOT NULL,
        "author_id" uuid NOT NULL,
        "author_type" "forum_author_type_enum" NOT NULL,
        "author_name" character varying NOT NULL,
        "author_avatar_url" character varying,
        "parent_reply_id" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "deleted_by" uuid,
        "is_edited" boolean NOT NULL DEFAULT false,
        "edited_at" TIMESTAMP,
        "is_solution" boolean NOT NULL DEFAULT false,
        "marked_solution_at" TIMESTAMP,
        "marked_solution_by" uuid,
        CONSTRAINT "PK_forum_replies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_replies_thread" FOREIGN KEY ("thread_id") 
          REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_forum_replies_parent" FOREIGN KEY ("parent_reply_id") 
          REFERENCES "forum_replies"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create forum_thread_views table
    await queryRunner.query(`
      CREATE TABLE "forum_thread_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "thread_id" uuid NOT NULL,
        "viewer_id" uuid NOT NULL,
        "viewer_type" "forum_author_type_enum" NOT NULL,
        "last_viewed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_forum_thread_views" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_thread_views_thread" FOREIGN KEY ("thread_id") 
          REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_forum_thread_views_unique" UNIQUE ("thread_id", "viewer_id", "viewer_type")
      )
    `);

    // Create indexes for forum_categories
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_categories_cohort_sort" ON "forum_categories" ("cohort_id", "sort_order")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_categories_cohort_vertical" ON "forum_categories" ("cohort_id", "vertical_id")
    `);

    // Create indexes for forum_threads
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_threads_category_pinned_created" ON "forum_threads" ("category_id", "is_pinned", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_threads_category_last_reply" ON "forum_threads" ("category_id", "last_reply_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_threads_author" ON "forum_threads" ("author_id", "author_type")
    `);

    // Create indexes for forum_replies
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_replies_thread_created" ON "forum_replies" ("thread_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_replies_author" ON "forum_replies" ("author_id", "author_type")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_replies_parent" ON "forum_replies" ("parent_reply_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_forum_replies_parent"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_replies_author"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_replies_thread_created"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_threads_author"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_threads_category_last_reply"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_threads_category_pinned_created"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_categories_cohort_vertical"`);
    await queryRunner.query(`DROP INDEX "IDX_forum_categories_cohort_sort"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "forum_thread_views"`);
    await queryRunner.query(`DROP TABLE "forum_replies"`);
    await queryRunner.query(`DROP TABLE "forum_threads"`);
    await queryRunner.query(`DROP TABLE "forum_categories"`);

    // Drop enum
    await queryRunner.query(`DROP TYPE "forum_author_type_enum"`);
  }
}
