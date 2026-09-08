import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizationIdToVerificationCode1787246256572 implements MigrationInterface {
  name = "AddOrganizationIdToVerificationCode1787246256572";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "verification_codes" 
      ADD COLUMN "organization_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "verification_codes"
      ADD CONSTRAINT "FK_verification_codes_organization"
      FOREIGN KEY ("organization_id") 
      REFERENCES "organizations"("id") 
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "verification_codes" 
      DROP CONSTRAINT "FK_verification_codes_organization"
    `);

    await queryRunner.query(`
      ALTER TABLE "verification_codes" 
      DROP COLUMN "organization_id"
    `);
  }
}
