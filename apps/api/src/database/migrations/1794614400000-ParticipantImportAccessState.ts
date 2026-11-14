import { MigrationInterface, QueryRunner } from "typeorm";

/** Correct legacy imports without deactivating accounts or changing visited/team records. */
export class ParticipantImportAccessState1794614400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query("SELECT pg_advisory_xact_lock(hashtext('participant-learning-import'))");
    await q.query(`WITH corrected AS (
      UPDATE participants p SET status = 'imported', updated_at = CURRENT_TIMESTAMP
      WHERE p.status = 'active' AND p.must_change_password = true
        AND p.onboarding_complete = false AND p.profile_confirmed_at IS NULL AND p.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM refresh_tokens r WHERE r."participantId" = p.id)
      RETURNING p.id
    ) INSERT INTO audit_logs (action, entity_type, description, before, after, metadata)
      SELECT 'bulk_action', 'Participant', 'Corrected unaccessed imports to the initial participant state',
        '{"status":"active"}'::jsonb, '{"status":"imported"}'::jsonb,
        jsonb_build_object('source', 'ParticipantImportAccessState1794614400000', 'participantIds', jsonb_agg(id))
      FROM corrected HAVING count(*) > 0`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE participants SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'imported' AND id IN (
        SELECT jsonb_array_elements_text(metadata->'participantIds')::uuid FROM audit_logs
        WHERE metadata->>'source' = 'ParticipantImportAccessState1794614400000'
      )`);
    await q.query(`DELETE FROM audit_logs WHERE metadata->>'source' = 'ParticipantImportAccessState1794614400000'`);
  }
}
