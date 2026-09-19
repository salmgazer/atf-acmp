import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGoogleCalendarLink1790000200000 implements MigrationInterface {
  name = "AddGoogleCalendarLink1790000200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions" 
      ADD COLUMN IF NOT EXISTS "google_calendar_link" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_sessions" 
      DROP COLUMN IF EXISTS "google_calendar_link"
    `);
  }
}
