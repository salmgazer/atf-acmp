import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRegistrationEndFromCohortDeadlines1723315200000 implements MigrationInterface {
  name = "RemoveRegistrationEndFromCohortDeadlines1723315200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove registrationEnd key from the deadlines JSONB column in cohorts table
    await queryRunner.query(`
      UPDATE cohorts 
      SET deadlines = deadlines - 'registrationEnd'
      WHERE deadlines ? 'registrationEnd'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add registrationEnd with null value to all cohorts
    // Note: Original values cannot be restored as they were not backed up
    await queryRunner.query(`
      UPDATE cohorts 
      SET deadlines = deadlines || '{"registrationEnd": null}'::jsonb
      WHERE NOT (deadlines ? 'registrationEnd')
    `);
  }
}
