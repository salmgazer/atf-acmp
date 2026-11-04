import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartnerSubmissionImports1793793600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE brief_contacts (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      brief_id uuid NOT NULL REFERENCES briefs(id) ON DELETE CASCADE, name varchar(255) NOT NULL, email varchar(255) NOT NULL,
      role varchar(255), phone varchar(50), is_primary boolean NOT NULL DEFAULT false, is_submitter boolean NOT NULL DEFAULT false,
      CONSTRAINT brief_contact_normalized_email CHECK(email = lower(btrim(email)))
    )`);
    await q.query(`CREATE UNIQUE INDEX brief_contact_email_unique ON brief_contacts(brief_id,email)`);
    await q.query(`CREATE UNIQUE INDEX brief_contact_primary_unique ON brief_contacts(brief_id) WHERE is_primary = true AND deleted_at IS NULL`);
    await q.query(`INSERT INTO brief_contacts(brief_id,name,email,role,phone,is_primary)
      SELECT id,coalesce(secondary_contact->>'name',''),lower(btrim(secondary_contact->>'email')),secondary_contact->>'role',secondary_contact->>'phone',true
      FROM briefs WHERE deleted_at IS NULL AND btrim(coalesce(secondary_contact->>'email','')) ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`);
    await q.query(`CREATE TABLE partner_import_records (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      cohort_id uuid NOT NULL REFERENCES cohorts(id), session_id uuid NOT NULL, opportunity_number integer NOT NULL CHECK(opportunity_number BETWEEN 1 AND 3),
      brief_id uuid NOT NULL REFERENCES briefs(id) ON DELETE RESTRICT, batch_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
      content_hash varchar(64) NOT NULL, source_name varchar(255) NOT NULL, source_timezone varchar(100) NOT NULL, source_row integer NOT NULL, source_data jsonb NOT NULL
    )`);
    await q.query(`CREATE UNIQUE INDEX partner_import_source_unique ON partner_import_records(cohort_id,session_id,opportunity_number)`);
    await q.query(`CREATE TABLE brief_event_host_invitations (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      event_id uuid NOT NULL REFERENCES brief_events(id) ON DELETE CASCADE, email varchar(255) NOT NULL, active boolean NOT NULL DEFAULT true,
      sequence integer NOT NULL DEFAULT 0, event_revision integer NOT NULL DEFAULT 0, email_sequence integer NOT NULL DEFAULT -1
    )`);
    await q.query(`CREATE UNIQUE INDEX brief_event_host_email_unique ON brief_event_host_invitations(event_id,email)`);
    // Baseline existing events without replaying host notifications on deployment.
    await q.query(`INSERT INTO brief_event_host_invitations(event_id,email,active,event_revision,email_sequence)
      SELECT event.id,coalesce(contact.email,lower(btrim(org.email))),event.status = 'scheduled',event.revision,0
      FROM brief_events event JOIN briefs brief ON brief.id = event.brief_id JOIN organizations org ON org.id = brief.organization_id
      LEFT JOIN brief_contacts contact ON contact.brief_id = brief.id AND contact.is_primary = true AND contact.deleted_at IS NULL
      WHERE event.deleted_at IS NULL`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE brief_event_host_invitations`);
    await q.query(`DROP TABLE partner_import_records`);
    await q.query(`DROP TABLE brief_contacts`);
  }
}
