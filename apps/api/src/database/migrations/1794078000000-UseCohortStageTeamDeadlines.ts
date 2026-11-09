import { MigrationInterface, QueryRunner } from "typeorm";
export class UseCohortStageTeamDeadlines1794078000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE stages ALTER COLUMN start_date TYPE timestamptz USING start_date AT TIME ZONE 'UTC', ALTER COLUMN deadline TYPE timestamptz USING deadline AT TIME ZONE 'UTC'`);
    await q.query(`ALTER TABLE cohorts ADD COLUMN team_joining_stage_id uuid, ADD COLUMN learning_certification_stage_id uuid,
      ADD CONSTRAINT cohort_team_joining_stage_fk FOREIGN KEY (team_joining_stage_id) REFERENCES stages(id) ON DELETE SET NULL,
      ADD CONSTRAINT cohort_learning_certification_stage_fk FOREIGN KEY (learning_certification_stage_id) REFERENCES stages(id) ON DELETE SET NULL`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE cohorts DROP COLUMN team_joining_stage_id, DROP COLUMN learning_certification_stage_id`);
    await q.query(`ALTER TABLE stages ALTER COLUMN start_date TYPE timestamp USING start_date AT TIME ZONE 'UTC', ALTER COLUMN deadline TYPE timestamp USING deadline AT TIME ZONE 'UTC'`);
  }
}
