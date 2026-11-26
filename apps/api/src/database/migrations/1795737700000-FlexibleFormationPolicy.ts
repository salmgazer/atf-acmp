import { MigrationInterface, QueryRunner } from 'typeorm';
export class FlexibleFormationPolicy1795737700000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE cohorts ADD COLUMN formation_defaults jsonb');
    await q.query('ALTER TABLE teams ADD COLUMN builder_policy jsonb');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE teams DROP COLUMN builder_policy');
    await q.query('ALTER TABLE cohorts DROP COLUMN formation_defaults');
  }
}
