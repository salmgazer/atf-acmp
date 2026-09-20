import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAiEvaluationFieldsToStages1723400000000 implements MigrationInterface {
  name = "AddAiEvaluationFieldsToStages1723400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add requires_ai_evaluation column with default false
    await queryRunner.query(`
      ALTER TABLE stages 
      ADD COLUMN IF NOT EXISTS requires_ai_evaluation BOOLEAN NOT NULL DEFAULT false
    `);

    // Add evaluation_prompt column (nullable text)
    await queryRunner.query(`
      ALTER TABLE stages 
      ADD COLUMN IF NOT EXISTS evaluation_prompt TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the columns
    await queryRunner.query(`
      ALTER TABLE stages 
      DROP COLUMN IF EXISTS evaluation_prompt
    `);

    await queryRunner.query(`
      ALTER TABLE stages 
      DROP COLUMN IF EXISTS requires_ai_evaluation
    `);
  }
}
