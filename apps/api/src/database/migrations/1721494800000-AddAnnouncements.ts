import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnnouncements1721494800000 implements MigrationInterface {
  name = "AddAnnouncements1721494800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."announcements_audience_enum" AS ENUM('all', 'vertical', 'team', 'organization', 'mentor')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."announcements_status_enum" AS ENUM('draft', 'scheduled', 'published', 'archived')
    `);

    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "audience" "public"."announcements_audience_enum" NOT NULL DEFAULT 'all',
        "audienceValue" jsonb,
        "status" "public"."announcements_status_enum" NOT NULL DEFAULT 'draft',
        "scheduledAt" TIMESTAMP,
        "publishedAt" TIMESTAMP,
        "isPinned" boolean NOT NULL DEFAULT false,
        "readCount" integer NOT NULL DEFAULT 0,
        "cohortId" uuid NOT NULL,
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "announcements" 
      ADD CONSTRAINT "FK_announcements_cohort" 
      FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "announcements" 
      ADD CONSTRAINT "FK_announcements_user" 
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_cohort" ON "announcements" ("cohortId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_status" ON "announcements" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_audience" ON "announcements" ("audience")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_scheduledAt" ON "announcements" ("scheduledAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_announcements_scheduledAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_announcements_audience"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_announcements_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_announcements_cohort"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP CONSTRAINT "FK_announcements_user"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP CONSTRAINT "FK_announcements_cohort"`);
    await queryRunner.query(`DROP TABLE "announcements"`);
    await queryRunner.query(`DROP TYPE "public"."announcements_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."announcements_audience_enum"`);
  }
}
