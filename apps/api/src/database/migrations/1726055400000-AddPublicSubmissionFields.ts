import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicSubmissionFields1726055400000 implements MigrationInterface {
  name = "AddPublicSubmissionFields1726055400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // ORGANIZATION TABLE ADDITIONS
    // =========================================================================
    
    // Add city field
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "city" varchar(255)
    `);

    // Add sector field (separate from industry for public form)
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sector" varchar(255)
    `);

    // Add sector_other for "Other" option
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sector_other" varchar(255)
    `);

    // Add submitter details (person filling out form, may differ from contact)
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "submitter_name" varchar(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "submitter_designation" varchar(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "submitter_department" varchar(255)
    `);

    // Flag for public form submissions
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "public_submission" boolean DEFAULT false
    `);

    // Consent tracking
    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "consent_given" boolean DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "consent_timestamp" timestamp
    `);

    // =========================================================================
    // BRIEF TABLE ADDITIONS
    // =========================================================================

    // Session tracking for duplicate prevention
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "session_id" varchar(255)
    `);

    // Opportunity number within a session (1, 2, or 3)
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "opportunity_number" integer
    `);

    // Impact goal fields
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "what_changes" text
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "affected_count" varchar(255)
    `);

    // Data access fields
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "data_description" text
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "data_access" varchar(255)
    `);

    // Secondary contact (JSON: name, role, email, phone)
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "secondary_contact" jsonb
    `);

    // Scoring answers (JSON: q1-q8 keys and text)
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "scoring_answers" jsonb
    `);

    // Fit scoring
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "fit_score" integer
    `);

    // Create enum type for fit band
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "brief_fit_band_enum" AS ENUM (
          'strong_fit',
          'promising',
          'different_solution',
          'override_digitise',
          'override_collect_data',
          'override_simpler_tool'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "fit_band" "brief_fit_band_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "score_override" varchar(255)
    `);

    // Impact scoring
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "depth_score" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "breadth_score" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "impact_score" integer
    `);

    // Create enum type for impact band
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "brief_impact_band_enum" AS ENUM (
          'high_impact',
          'moderate_impact',
          'lower_impact'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "impact_band" "brief_impact_band_enum"
    `);

    // Country lead notes
    await queryRunner.query(`
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "country_lead_notes" text
    `);

    // Add index on session_id for duplicate detection
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_briefs_session_id" ON "briefs" ("session_id")
    `);

    // Add index on public_submission for filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organizations_public_submission" ON "organizations" ("public_submission")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_briefs_session_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_public_submission"`);

    // Brief columns
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "country_lead_notes"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "impact_band"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "impact_score"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "breadth_score"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "depth_score"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "score_override"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "fit_band"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "fit_score"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "scoring_answers"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "secondary_contact"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "data_access"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "data_description"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "affected_count"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "what_changes"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "opportunity_number"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN IF EXISTS "session_id"`);

    // Organization columns
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "consent_timestamp"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "consent_given"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "public_submission"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "submitter_department"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "submitter_designation"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "submitter_name"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "sector_other"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "sector"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "city"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "brief_impact_band_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "brief_fit_band_enum"`);
  }
}
