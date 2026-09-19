import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParticipantProfileImage1789312000000 implements MigrationInterface {
  name = "AddParticipantProfileImage1789312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "participants" 
      ADD COLUMN IF NOT EXISTS "profile_image_url" VARCHAR(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "participants" 
      DROP COLUMN IF EXISTS "profile_image_url"
    `);
  }
}
