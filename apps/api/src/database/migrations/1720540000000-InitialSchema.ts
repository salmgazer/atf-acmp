import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial schema migration that creates all base tables.
 * This must run before all other migrations (timestamp 1720540000000 is before first migration 1720540800000).
 * 
 * Tables are created in dependency order to satisfy foreign key constraints.
 */
export class InitialSchema1720540000000 implements MigrationInterface {
  name = "InitialSchema1720540000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types first
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "role_enum" AS ENUM ('super_admin', 'program_manager', 'evaluator', 'viewer', 'organization', 'participant', 'mentor');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "cohort_status_enum" AS ENUM ('draft', 'active', 'evaluation', 'completed', 'archived');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organization_status_enum" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organization_user_role_enum" AS ENUM ('owner', 'admin', 'member');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "participant_status_enum" AS ENUM ('imported', 'active', 'onboarding', 'ready', 'assigned', 'inactive');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "team_status_enum" AS ENUM ('forming', 'active', 'submitted', 'evaluated', 'disqualified');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "team_role_enum" AS ENUM ('lead', 'co_lead', 'member');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "brief_status_enum" AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "brief_fit_band_enum" AS ENUM ('strong_fit', 'promising', 'different_solution', 'override_digitise', 'override_collect_data', 'override_simpler_tool');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "brief_impact_band_enum" AS ENUM ('high_impact', 'moderate_impact', 'lower_impact');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mentor_status_enum" AS ENUM ('imported', 'active', 'inactive');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "verification_code_type_enum" AS ENUM ('magic_link', 'password_reset', 'email_verification');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // ========================================
    // CORE TABLES (no foreign key dependencies)
    // ========================================

    // Users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar UNIQUE NOT NULL,
        "role" "role_enum" NOT NULL,
        "first_name" varchar,
        "last_name" varchar,
        "avatar_url" varchar,
        "firebase_uid" varchar,
        "password_hash" varchar,
        "must_change_password" boolean DEFAULT false,
        "is_active" boolean DEFAULT true,
        "last_login_at" timestamp,
        "password_changed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);

    // Cohorts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cohorts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "status" "cohort_status_enum" DEFAULT 'draft',
        "team_size_min" int DEFAULT 3,
        "team_size_max" int DEFAULT 5,
        "deadlines" jsonb DEFAULT '{}',
        "rubric" jsonb,
        "countries" jsonb DEFAULT '[]',
        "verticals" jsonb DEFAULT '[]',
        "brief_cap" int DEFAULT 50,
        "max_teams_per_brief" int DEFAULT 25,
        "leaderboard_config" jsonb DEFAULT '{}',
        "stage_names" jsonb DEFAULT '{}',
        "session_rate" decimal(10,2) DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cohorts_status" ON "cohorts" ("status")`);

    // ========================================
    // TABLES WITH COHORT DEPENDENCY
    // ========================================

    // Verticals table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verticals" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "brief_cap" int DEFAULT 10,
        "brief_count" int DEFAULT 0,
        "display_order" int DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_verticals_cohort_name" ON "verticals" ("cohort_id", "name")`);

    // Organizations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "email" varchar UNIQUE NOT NULL,
        "website" varchar,
        "logo_url" varchar,
        "description" text,
        "industry" varchar,
        "country" varchar,
        "city" varchar,
        "sector" varchar,
        "sector_other" varchar,
        "submitter_name" varchar,
        "submitter_designation" varchar,
        "submitter_department" varchar,
        "public_submission" boolean DEFAULT false,
        "consent_given" boolean DEFAULT false,
        "consent_timestamp" timestamp,
        "contact_person" varchar,
        "contact_phone" varchar,
        "status" "organization_status_enum" DEFAULT 'pending',
        "is_active" boolean DEFAULT true,
        "approved_at" timestamp,
        "approved_by" varchar,
        "rejection_reason" text,
        "cohort_id" uuid REFERENCES "cohorts"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organizations_email" ON "organizations" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_public_submission" ON "organizations" ("public_submission")`);

    // Organization users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
        "user_id" uuid NOT NULL,
        "role" "organization_user_role_enum" DEFAULT 'member',
        "is_primary" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organization_users_org_user" ON "organization_users" ("organization_id", "user_id")`);

    // Participants table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "participants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "participant_id" varchar UNIQUE NOT NULL,
        "email" varchar UNIQUE NOT NULL,
        "first_name" varchar NOT NULL,
        "last_name" varchar NOT NULL,
        "country" varchar NOT NULL,
        "institution" varchar,
        "phone_number" varchar,
        "skills" jsonb DEFAULT '[]',
        "interests" jsonb DEFAULT '[]',
        "firebase_uid" varchar,
        "password_hash" varchar,
        "must_change_password" boolean DEFAULT true,
        "onboarding_complete" boolean DEFAULT false,
        "profile_image_url" varchar,
        "status" "participant_status_enum" DEFAULT 'imported',
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_participants_participant_id" ON "participants" ("participant_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_participants_email" ON "participants" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_participants_cohort_country" ON "participants" ("cohort_id", "country")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_participants_cohort_status" ON "participants" ("cohort_id", "status")`);

    // Mentors table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mentors" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar UNIQUE NOT NULL,
        "first_name" varchar NOT NULL,
        "last_name" varchar NOT NULL,
        "phone" varchar,
        "company" varchar,
        "title" varchar,
        "bio" text,
        "profile_image_url" varchar,
        "expertise" jsonb DEFAULT '[]',
        "capabilities" jsonb DEFAULT '[]',
        "google_calendar_id" varchar,
        "linkedin_url" varchar,
        "max_teams" int DEFAULT 3,
        "max_claims" int DEFAULT 3,
        "vertical_scope" jsonb DEFAULT '[]',
        "firebase_uid" varchar,
        "session_rate_override" decimal(10,2),
        "status" "mentor_status_enum" DEFAULT 'active',
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mentors_email" ON "mentors" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_mentors_cohort_status" ON "mentors" ("cohort_id", "status")`);

    // Briefs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "briefs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "problem_statement" text NOT NULL,
        "expected_outcomes" text NOT NULL,
        "vertical_id" uuid REFERENCES "verticals"("id"),
        "status" "brief_status_enum" DEFAULT 'draft',
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id"),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
        "session_id" varchar,
        "opportunity_number" int,
        "what_changes" text,
        "affected_count" varchar,
        "data_description" text,
        "data_access" varchar,
        "secondary_contact" jsonb,
        "scoring_answers" jsonb,
        "fit_score" int,
        "fit_band" "brief_fit_band_enum",
        "score_override" varchar,
        "depth_score" int,
        "breadth_score" int,
        "impact_score" int,
        "impact_band" "brief_impact_band_enum",
        "priority_score" int DEFAULT 0,
        "country_lead_notes" text,
        "teams_count" int DEFAULT 0,
        "max_teams" int DEFAULT 25,
        "tags" jsonb DEFAULT '[]',
        "resources" jsonb,
        "video_url" varchar,
        "video_thumbnail_url" varchar,
        "image_urls" jsonb DEFAULT '[]',
        "review_feedback" text,
        "reviewed_by" varchar,
        "reviewed_at" timestamp,
        "submitted_at" timestamp,
        "approved_at" timestamp,
        "revision_count" int DEFAULT 0,
        "current_version" int DEFAULT 1,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_briefs_cohort_status" ON "briefs" ("cohort_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_briefs_organization" ON "briefs" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_briefs_vertical" ON "briefs" ("vertical_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_briefs_session" ON "briefs" ("session_id")`);

    // Teams table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teams" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "status" "team_status_enum" DEFAULT 'forming',
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id"),
        "brief_id" uuid REFERENCES "briefs"("id"),
        "mentor_id" uuid REFERENCES "mentors"("id"),
        "invite_code" varchar UNIQUE NOT NULL,
        "metadata" jsonb,
        "github_repo_url" varchar,
        "disqualification_reason" varchar,
        "disqualified_at" timestamp,
        "disqualified_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_teams_cohort_status" ON "teams" ("cohort_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_teams_brief" ON "teams" ("brief_id")`);

    // Team members table
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "team_member_status_enum" AS ENUM ('pending', 'confirmed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_members" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "participant_id" uuid NOT NULL REFERENCES "participants"("id"),
        "role" "team_role_enum" DEFAULT 'member',
        "status" "team_member_status_enum" DEFAULT 'confirmed',
        "joined_at" timestamp DEFAULT now(),
        "confirmed_at" timestamp,
        "confirmed_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp,
        UNIQUE ("team_id", "participant_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_team_members_team" ON "team_members" ("team_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_team_members_participant" ON "team_members" ("participant_id")`);

    // Verification codes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verification_codes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL,
        "code" varchar NOT NULL,
        "type" "verification_code_type_enum" NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp,
        "attempts" int DEFAULT 0,
        "portal" varchar,
        "user_id" uuid REFERENCES "users"("id"),
        "organization_id" uuid REFERENCES "organizations"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_verification_codes_email" ON "verification_codes" ("email")`);

    // Stages table
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "stage_type_enum" AS ENUM ('document', 'video', 'url', 'text', 'mixed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "submission_status_enum" AS ENUM ('draft', 'submitted', 'late', 'pending_approval', 'approved', 'rejected', 'evaluated');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "cohort_id" uuid NOT NULL REFERENCES "cohorts"("id"),
        "number" int NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "instructions" text,
        "type" "stage_type_enum" DEFAULT 'mixed',
        "start_date" timestamp,
        "deadline" timestamp NOT NULL,
        "requirements" jsonb DEFAULT '{}',
        "weight_percentage" decimal(5,2) DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "allow_late_submissions" boolean DEFAULT true,
        "late_penalty_percentage" decimal(5,2) DEFAULT 0,
        "sort_order" int DEFAULT 0,
        "unlocks_mentor_claim" boolean DEFAULT false,
        "requires_manual_approval" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stages_cohort_number" ON "stages" ("cohort_id", "number")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stages_cohort_active" ON "stages" ("cohort_id", "is_active")`);

    // Submissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "submissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "team_id" uuid NOT NULL REFERENCES "teams"("id"),
        "stage_id" uuid NOT NULL REFERENCES "stages"("id"),
        "status" "submission_status_enum" DEFAULT 'draft',
        "content" jsonb DEFAULT '{}',
        "file_urls" jsonb DEFAULT '[]',
        "github_url" varchar,
        "video_url" varchar,
        "submitted_at" timestamp,
        "submitted_by" varchar,
        "is_late" boolean DEFAULT false,
        "late_minutes" int DEFAULT 0,
        "score" decimal(5,2),
        "evaluated_at" timestamp,
        "evaluated_by" varchar,
        "evaluation_notes" text,
        "feedback" jsonb,
        "approved_at" timestamp,
        "approved_by" varchar,
        "approval_notes" text,
        "rejected_at" timestamp,
        "rejected_by" varchar,
        "rejection_reason" text,
        "version" int DEFAULT 1,
        "last_saved_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp,
        UNIQUE ("team_id", "stage_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_submissions_stage_status" ON "submissions" ("stage_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_submissions_submitted_at" ON "submissions" ("submitted_at")`);

    // Enable uuid-ossp extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    console.log("InitialSchema1720540000000: Base tables created successfully");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "submissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_codes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "briefs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mentors" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "participants" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verticals" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cohorts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "submission_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "stage_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_member_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "verification_code_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "mentor_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "brief_impact_band_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "brief_fit_band_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "brief_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "participant_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_user_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cohort_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_enum"`);
  }
}
