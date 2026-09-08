import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJournalEntries1721232000000 implements MigrationInterface {
  name = "AddJournalEntries1721232000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create journal_entry_status enum
    await queryRunner.query(`
      CREATE TYPE "journal_entry_status_enum" AS ENUM ('draft', 'published')
    `);

    // Create journal_entries table
    await queryRunner.query(`
      CREATE TABLE "journal_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "author_id" uuid NOT NULL REFERENCES "participants"("id"),
        "week_number" integer NOT NULL,
        "title" text,
        "content" text NOT NULL,
        "highlights" jsonb,
        "challenges" jsonb,
        "next_week_goals" jsonb,
        "status" "journal_entry_status_enum" NOT NULL DEFAULT 'published',
        "editable_until" timestamp NOT NULL,
        "last_edited_at" timestamp,
        "last_edited_by" uuid REFERENCES "participants"("id"),
        "word_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("team_id", "week_number")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_journal_entries_team_week" ON "journal_entries" ("team_id", "week_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_journal_entries_cohort_week" ON "journal_entries" ("cohort_id", "week_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_journal_entries_created_at" ON "journal_entries" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_journal_entries_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_journal_entries_cohort_week"`);
    await queryRunner.query(`DROP INDEX "IDX_journal_entries_team_week"`);
    await queryRunner.query(`DROP TABLE "journal_entries"`);
    await queryRunner.query(`DROP TYPE "journal_entry_status_enum"`);
  }
}
