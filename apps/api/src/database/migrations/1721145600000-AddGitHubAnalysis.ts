import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGitHubAnalysis1721145600000 implements MigrationInterface {
  name = "AddGitHubAnalysis1721145600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "github_analyses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "submission_id" uuid REFERENCES "submissions"("id") ON DELETE SET NULL,
        "github_url" varchar NOT NULL,
        "repo_full_name" varchar NOT NULL,
        "metrics" jsonb NOT NULL,
        "code_structure" jsonb NOT NULL,
        "commit_patterns" jsonb NOT NULL,
        "readme" text,
        "summary" jsonb,
        "analyzed_at" timestamp NOT NULL,
        "analysis_version" integer NOT NULL DEFAULT 1,
        "error_message" varchar,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_github_analyses_team" ON "github_analyses" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_github_analyses_submission" ON "github_analyses" ("submission_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_github_analyses_analyzed_at" ON "github_analyses" ("analyzed_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_github_analyses_analyzed_at"`);
    await queryRunner.query(`DROP INDEX "IDX_github_analyses_submission"`);
    await queryRunner.query(`DROP INDEX "IDX_github_analyses_team"`);
    await queryRunner.query(`DROP TABLE "github_analyses"`);
  }
}
