import { MigrationInterface, QueryRunner } from "typeorm";

export class MoveGithubUrlToTeam1789800000000 implements MigrationInterface {
  name = "MoveGithubUrlToTeam1789800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add github_repo_url column to teams table
    await queryRunner.query(`
      ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "github_repo_url" VARCHAR(500) NULL
    `);

    // Optionally migrate existing github_url data from submissions to teams
    // This takes the most recent non-null github_url from each team's submissions
    await queryRunner.query(`
      UPDATE "teams" t
      SET "github_repo_url" = sub.github_url
      FROM (
        SELECT DISTINCT ON (s.team_id) s.team_id, s.github_url
        FROM "submissions" s
        WHERE s.github_url IS NOT NULL AND s.github_url != ''
        ORDER BY s.team_id, s.created_at DESC
      ) sub
      WHERE t.id = sub.team_id AND t.github_repo_url IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teams" DROP COLUMN IF EXISTS "github_repo_url"
    `);
  }
}
