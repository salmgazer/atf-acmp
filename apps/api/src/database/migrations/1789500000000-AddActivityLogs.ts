import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActivityLogs1789500000000 implements MigrationInterface {
    name = 'AddActivityLogs1789500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create activity type enum (idempotent)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."activity_logs_activity_type_enum" AS ENUM(
                    'login',
                    'logout',
                    'token_refresh',
                    'page_view',
                    'dashboard_view',
                    'api_request',
                    'submission_create',
                    'submission_update',
                    'team_create',
                    'team_update',
                    'brief_view',
                    'evaluation_create',
                    'mentor_session',
                    'forum_post',
                    'chat_message'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create portal enum (idempotent)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."activity_logs_portal_enum" AS ENUM(
                    'staff',
                    'participant',
                    'organization',
                    'mentor',
                    'public'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create activity_logs table (idempotent)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "activity_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "user_id" uuid,
                "participant_id" uuid,
                "cohort_id" uuid,
                "activity_type" "public"."activity_logs_activity_type_enum" NOT NULL,
                "portal" "public"."activity_logs_portal_enum" NOT NULL DEFAULT 'public',
                "path" character varying,
                "method" character varying,
                "status_code" integer,
                "response_time_ms" integer,
                "ip_address" character varying,
                "user_agent" text,
                "metadata" jsonb,
                "hour_of_day" smallint,
                "day_of_week" smallint,
                CONSTRAINT "PK_activity_logs" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for efficient querying (idempotent)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_type_created" ON "activity_logs" ("activity_type", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_user_created" ON "activity_logs" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_cohort_created" ON "activity_logs" ("cohort_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_portal_created" ON "activity_logs" ("portal", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_created" ON "activity_logs" ("created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_cohort_type_created" ON "activity_logs" ("cohort_id", "activity_type", "created_at")`);
        
        // Index for hourly aggregation queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_hour" ON "activity_logs" ("hour_of_day", "created_at")`);
        
        // Index for weekly aggregation queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_day" ON "activity_logs" ("day_of_week", "created_at")`);

        // Foreign key constraints (idempotent - check if exists first)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "activity_logs" 
                ADD CONSTRAINT "FK_activity_logs_user" 
                FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "activity_logs" 
                ADD CONSTRAINT "FK_activity_logs_cohort" 
                FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "FK_activity_logs_cohort"`);
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "FK_activity_logs_user"`);
        
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_day"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_hour"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_cohort_type_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_portal_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_cohort_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_user_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_type_created"`);
        
        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "activity_logs"`);
        
        // Drop enums
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."activity_logs_portal_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."activity_logs_activity_type_enum"`);
    }
}
