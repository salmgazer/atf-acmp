import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCalendlyFromMentors1789214854000 implements MigrationInterface {
  name = "RemoveCalendlyFromMentors1789214854000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove calendly_link column from mentors table
    await queryRunner.query(`
      ALTER TABLE "mentors" DROP COLUMN IF EXISTS "calendly_link"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add calendly_link column if rolling back
    await queryRunner.query(`
      ALTER TABLE "mentors" ADD COLUMN "calendly_link" character varying
    `);
  }
}
