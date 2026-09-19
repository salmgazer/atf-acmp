import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateMentorStatusDefault1789215143000 implements MigrationInterface {
  name = "UpdateMentorStatusDefault1789215143000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update all existing mentors with 'imported' status to 'active'
    await queryRunner.query(`
      UPDATE mentors 
      SET status = 'active' 
      WHERE status = 'imported'
    `);

    // Update the default value for the status column
    await queryRunner.query(`
      ALTER TABLE mentors 
      ALTER COLUMN status SET DEFAULT 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the default value
    await queryRunner.query(`
      ALTER TABLE mentors 
      ALTER COLUMN status SET DEFAULT 'imported'
    `);
    
    // Note: We don't revert the status changes for existing mentors
    // as that could disrupt active mentor relationships
  }
}
