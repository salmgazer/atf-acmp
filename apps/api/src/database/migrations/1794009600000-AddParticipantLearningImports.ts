import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParticipantLearningImports1794009600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE participants
      ADD COLUMN lms_email varchar(255), ADD COLUMN whatsapp_number varchar(50), ADD COLUMN city varchar(150), ADD COLUMN location_type varchar(150), ADD COLUMN gender varchar(100),
      ADD COLUMN education_level varchar(150), ADD COLUMN current_affiliation varchar(150), ADD COLUMN field_of_study varchar(255),
      ADD COLUMN python_skill varchar(255), ADD COLUMN git_skill varchar(255), ADD COLUMN ai_experience varchar(255), ADD COLUMN github_username varchar(255),
      ADD COLUMN learning_certificate_issued boolean, ADD COLUMN learning_certificate_id varchar(255), ADD COLUMN learning_certificate_date date,
      ADD COLUMN learning_finished_all_lessons boolean, ADD COLUMN learning_halfway_reached boolean, ADD COLUMN learning_imported_at timestamptz`);
    await q.query(`CREATE UNIQUE INDEX participant_learning_certificate_unique ON participants(learning_certificate_id) WHERE learning_certificate_id IS NOT NULL`);
    await q.query(`CREATE INDEX participant_lms_email_lookup ON participants(lms_email)`);
    await q.query(`CREATE TABLE participant_import_batches (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      cohort_id uuid NOT NULL REFERENCES cohorts(id), requested_by uuid NOT NULL REFERENCES users(id), source_name varchar(255) NOT NULL,
      state varchar NOT NULL DEFAULT 'queued', input jsonb NOT NULL, result jsonb NOT NULL DEFAULT '{}', error text
    )`);
    await q.query(`CREATE INDEX participant_import_batch_cohort_created ON participant_import_batches(cohort_id,created_at)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE participant_import_batches`);
    await q.query(`DROP INDEX participant_learning_certificate_unique`);
    await q.query(`DROP INDEX participant_lms_email_lookup`);
    await q.query(`ALTER TABLE participants DROP COLUMN lms_email, DROP COLUMN whatsapp_number, DROP COLUMN city, DROP COLUMN location_type, DROP COLUMN gender,
      DROP COLUMN education_level, DROP COLUMN current_affiliation, DROP COLUMN field_of_study, DROP COLUMN python_skill, DROP COLUMN git_skill, DROP COLUMN ai_experience, DROP COLUMN github_username,
      DROP COLUMN learning_certificate_issued, DROP COLUMN learning_certificate_id, DROP COLUMN learning_certificate_date, DROP COLUMN learning_finished_all_lessons, DROP COLUMN learning_halfway_reached, DROP COLUMN learning_imported_at`);
  }
}
