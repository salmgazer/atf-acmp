import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamBriefPreference1794960000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE teams ADD COLUMN brief_preference varchar(16) NOT NULL DEFAULT 'partner'
      CONSTRAINT teams_brief_preference_check CHECK (brief_preference IN ('partner', 'own'))`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE teams DROP COLUMN brief_preference`);
  }
}
