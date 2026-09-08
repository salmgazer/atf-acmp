import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCertificates1721493600000 implements MigrationInterface {
  name = "AddCertificates1721493600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create certificate tier enum
    await queryRunner.query(`
      CREATE TYPE "certificate_tier_enum" AS ENUM ('participation', 'completion', 'excellence', 'winner')
    `);

    // Create certificate status enum
    await queryRunner.query(`
      CREATE TYPE "certificate_status_enum" AS ENUM ('pending', 'generated', 'failed')
    `);

    // Create certificates table
    await queryRunner.query(`
      CREATE TABLE "certificates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "certificate_id" varchar NOT NULL,
        "cohort_id" uuid NOT NULL,
        "participant_id" uuid NOT NULL,
        "team_id" uuid,
        "tier" "certificate_tier_enum" NOT NULL,
        "status" "certificate_status_enum" NOT NULL DEFAULT 'pending',
        "participant_name" varchar NOT NULL,
        "team_name" varchar,
        "cohort_name" varchar NOT NULL,
        "vertical_name" varchar,
        "final_score" decimal(5,2),
        "rank" integer,
        "pdf_url" varchar,
        "qr_code_data" text,
        "generated_at" TIMESTAMP,
        "generated_by" uuid,
        "error_message" text,
        "verification_url" varchar,
        "download_count" integer NOT NULL DEFAULT 0,
        "last_downloaded_at" TIMESTAMP,
        CONSTRAINT "PK_certificates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_certificates_certificate_id" UNIQUE ("certificate_id"),
        CONSTRAINT "UQ_certificates_cohort_participant" UNIQUE ("cohort_id", "participant_id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD CONSTRAINT "FK_certificates_cohort"
      FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD CONSTRAINT "FK_certificates_participant"
      FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD CONSTRAINT "FK_certificates_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_certificates_tier" ON "certificates" ("tier")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_certificates_status" ON "certificates" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_certificates_status"`);
    await queryRunner.query(`DROP INDEX "IDX_certificates_tier"`);
    await queryRunner.query(`ALTER TABLE "certificates" DROP CONSTRAINT "FK_certificates_team"`);
    await queryRunner.query(`ALTER TABLE "certificates" DROP CONSTRAINT "FK_certificates_participant"`);
    await queryRunner.query(`ALTER TABLE "certificates" DROP CONSTRAINT "FK_certificates_cohort"`);
    await queryRunner.query(`DROP TABLE "certificates"`);
    await queryRunner.query(`DROP TYPE "certificate_status_enum"`);
    await queryRunner.query(`DROP TYPE "certificate_tier_enum"`);
  }
}
