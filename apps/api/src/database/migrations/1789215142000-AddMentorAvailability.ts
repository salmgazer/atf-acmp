import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMentorAvailability1789215142000 implements MigrationInterface {
  name = "AddMentorAvailability1789215142000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create mentor_availability table for recurring weekly slots
    await queryRunner.query(`
      CREATE TABLE "mentor_availability" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentor_id" uuid NOT NULL,
        "day_of_week" integer NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "duration_minutes" integer NOT NULL DEFAULT 45,
        "buffer_minutes" integer NOT NULL DEFAULT 15,
        "is_active" boolean NOT NULL DEFAULT true,
        "timezone" character varying NOT NULL DEFAULT 'Africa/Nairobi',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentor_availability" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mentor_availability_mentor" FOREIGN KEY ("mentor_id") 
          REFERENCES "mentors"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for mentor_availability
    await queryRunner.query(`
      CREATE INDEX "IDX_mentor_availability_mentor_id" ON "mentor_availability" ("mentor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_mentor_availability_mentor_day" ON "mentor_availability" ("mentor_id", "day_of_week")
    `);

    // Create mentor_availability_exceptions table for one-off overrides
    await queryRunner.query(`
      CREATE TABLE "mentor_availability_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentor_id" uuid NOT NULL,
        "date" date NOT NULL,
        "is_unavailable" boolean NOT NULL DEFAULT false,
        "custom_slots" jsonb,
        "reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentor_availability_exceptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mentor_availability_exceptions_mentor" FOREIGN KEY ("mentor_id") 
          REFERENCES "mentors"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for mentor_availability_exceptions
    await queryRunner.query(`
      CREATE INDEX "IDX_mentor_availability_exceptions_mentor_id" ON "mentor_availability_exceptions" ("mentor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_mentor_availability_exceptions_mentor_date" ON "mentor_availability_exceptions" ("mentor_id", "date")
    `);

    // Add unique constraint to prevent duplicate slots for same mentor/day/time
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_mentor_availability_slot" ON "mentor_availability" ("mentor_id", "day_of_week", "start_time")
    `);

    // Add unique constraint to prevent duplicate exceptions for same mentor/date
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_mentor_availability_exception_date" ON "mentor_availability_exceptions" ("mentor_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_mentor_availability_exception_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_mentor_availability_slot"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_availability_exceptions_mentor_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_availability_exceptions_mentor_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_availability_mentor_day"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mentor_availability_mentor_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "mentor_availability_exceptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mentor_availability"`);
  }
}
