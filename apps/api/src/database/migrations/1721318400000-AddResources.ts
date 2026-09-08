import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResources1721318400000 implements MigrationInterface {
  name = "AddResources1721318400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create resource_type enum
    await queryRunner.query(`
      CREATE TYPE "resource_type_enum" AS ENUM ('document', 'video', 'link', 'template')
    `);

    // Create resource_visibility enum
    await queryRunner.query(`
      CREATE TYPE "resource_visibility_enum" AS ENUM ('all', 'vertical', 'staff')
    `);

    // Create resources table
    await queryRunner.query(`
      CREATE TABLE "resources" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "cohort_id" uuid REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "vertical_id" uuid REFERENCES "verticals"("id") ON DELETE SET NULL,
        "title" varchar NOT NULL,
        "description" text,
        "type" "resource_type_enum" NOT NULL,
        "file_url" varchar,
        "external_url" varchar,
        "video_embed_url" varchar,
        "file_name" varchar,
        "file_size" integer,
        "file_type" varchar,
        "thumbnail_url" varchar,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "visibility" "resource_visibility_enum" NOT NULL DEFAULT 'all',
        "is_published" boolean NOT NULL DEFAULT true,
        "is_featured" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "download_count" integer NOT NULL DEFAULT 0,
        "view_count" integer NOT NULL DEFAULT 0,
        "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_resources_cohort_type" ON "resources" ("cohort_id", "type")`);
    await queryRunner.query(`CREATE INDEX "IDX_resources_cohort_vertical" ON "resources" ("cohort_id", "vertical_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_resources_published" ON "resources" ("is_published")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_resources_published"`);
    await queryRunner.query(`DROP INDEX "IDX_resources_cohort_vertical"`);
    await queryRunner.query(`DROP INDEX "IDX_resources_cohort_type"`);
    await queryRunner.query(`DROP TABLE "resources"`);
    await queryRunner.query(`DROP TYPE "resource_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "resource_type_enum"`);
  }
}
