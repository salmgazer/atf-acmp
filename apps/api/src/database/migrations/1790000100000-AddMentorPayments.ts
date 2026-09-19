import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMentorPayments1790000100000 implements MigrationInterface {
  name = "AddMentorPayments1790000100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create mentor_payment_status enum (idempotent)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mentor_payment_status_enum" AS ENUM ('pending', 'completed', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create mentor_payments table (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mentor_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "mentor_id" uuid NOT NULL,
        "amount" DECIMAL(10, 2) NOT NULL,
        "status" "mentor_payment_status_enum" NOT NULL DEFAULT 'pending',
        "sessions_count" INTEGER NOT NULL DEFAULT 0,
        "session_ids" JSONB NOT NULL DEFAULT '[]',
        "period_start" DATE,
        "period_end" DATE,
        "paid_at" TIMESTAMP,
        "paid_by" VARCHAR,
        "payment_reference" VARCHAR,
        "payment_method" VARCHAR,
        "notes" TEXT,
        CONSTRAINT "PK_mentor_payments" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint (idempotent)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "mentor_payments" 
        ADD CONSTRAINT "FK_mentor_payments_mentor" 
        FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add indexes (idempotent)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mentor_payments_mentor_id" ON "mentor_payments" ("mentor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mentor_payments_status" ON "mentor_payments" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mentor_payments_paid_at" ON "mentor_payments" ("paid_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mentor_payments_created_at" ON "mentor_payments" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_payments_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_payments_paid_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_payments_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_payments_mentor_id"`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "mentor_payments"`);

    // Drop enum
    await queryRunner.query(`DROP TYPE IF EXISTS "mentor_payment_status_enum"`);
  }
}
