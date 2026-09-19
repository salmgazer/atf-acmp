import { MigrationInterface, QueryRunner } from "typeorm";
import * as fs from "fs";
import * as path from "path";

/**
 * Initial schema migration that creates the complete database schema.
 * This migration reads from the accompanying .sql file which contains
 * the full schema dump from the development database.
 * 
 * Consolidated from 40 individual migrations on 2026-09-19.
 */
export class InitialSchema1720540000000 implements MigrationInterface {
  name = "InitialSchema1720540000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, "1720540000000-InitialSchema.sql");
    const sql = fs.readFileSync(sqlFilePath, "utf8");

    // Split by semicolons and execute each statement
    // Filter out empty statements and comments-only statements
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.match(/^--[\s\S]*$/));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await queryRunner.query(statement);
        } catch (error) {
          // Skip errors for things that might already exist (like extensions)
          // or SET commands that might not be supported
          const errorMessage = (error as Error).message || "";
          if (
            errorMessage.includes("already exists") ||
            errorMessage.includes("SET ")
          ) {
            console.log(`Skipping: ${errorMessage}`);
            continue;
          }
          throw error;
        }
      }
    }

    console.log("InitialSchema1720540000000: Schema created successfully");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all tables in reverse order (respecting foreign key constraints)
    // This is a destructive operation - use with caution
    const tables = [
      "typing_indicators",
      "message_reactions",
      "chat_messages",
      "channel_members",
      "chat_channels",
      "forum_thread_views",
      "forum_replies",
      "forum_threads",
      "forum_categories",
      "push_tokens",
      "notification_preferences",
      "notifications",
      "announcements",
      "certificates",
      "peer_reviews",
      "peer_review_assignments",
      "peer_review_rubrics",
      "github_analyses",
      "evaluation_jobs",
      "evaluations",
      "submission_history",
      "submissions",
      "stages",
      "journal_entries",
      "resources",
      "mentor_payments",
      "scheduled_sessions",
      "mentor_sessions",
      "mentor_claims",
      "mentor_availability_exceptions",
      "mentor_availability",
      "mentor_assignments",
      "mentors",
      "team_member_removal_requests",
      "team_invitations",
      "team_members",
      "teams",
      "brief_revisions",
      "briefs",
      "verticals",
      "participant_preferences",
      "participants",
      "organization_users",
      "organizations",
      "verification_codes",
      "refresh_tokens",
      "activity_logs",
      "audit_logs",
      "users",
      "cohorts",
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }

    // Drop all custom enum types
    const enumTypes = await queryRunner.query(`
      SELECT typname FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);

    for (const { typname } of enumTypes) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
    }

    console.log("InitialSchema1720540000000: Schema dropped successfully");
  }
}
