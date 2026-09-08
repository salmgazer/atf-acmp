import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVideoThumbnailUrl1787246256573 implements MigrationInterface {
  name = "AddVideoThumbnailUrl1787246256573";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "briefs" 
      ADD COLUMN "video_thumbnail_url" VARCHAR(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "briefs" 
      DROP COLUMN "video_thumbnail_url"
    `);
  }
}
