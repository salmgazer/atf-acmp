import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFields1728950400000 implements MigrationInterface {
  name = 'AddPasswordResetFields1728950400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add password reset fields to users table (staff)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "password_reset_token" varchar,
      ADD COLUMN IF NOT EXISTS "password_reset_expires" timestamp
    `);

    // Add password reset fields to participants table
    await queryRunner.query(`
      ALTER TABLE "participants" 
      ADD COLUMN IF NOT EXISTS "password_reset_token" varchar,
      ADD COLUMN IF NOT EXISTS "password_reset_expires" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove password reset fields from users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "password_reset_token",
      DROP COLUMN IF EXISTS "password_reset_expires"
    `);

    // Remove password reset fields from participants table
    await queryRunner.query(`
      ALTER TABLE "participants" 
      DROP COLUMN IF EXISTS "password_reset_token",
      DROP COLUMN IF EXISTS "password_reset_expires"
    `);
  }
}
