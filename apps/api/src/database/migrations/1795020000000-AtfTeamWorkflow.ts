import { MigrationInterface, QueryRunner } from "typeorm";

export class AtfTeamWorkflow1795020000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE stages ADD COLUMN workflow_key varchar(20)`);
    await q.query(`CREATE UNIQUE INDEX stages_cohort_workflow_key ON stages(cohort_id, workflow_key) WHERE deleted_at IS NULL AND workflow_key IS NOT NULL`);
    await q.query(`ALTER TABLE briefs ALTER COLUMN organization_id DROP NOT NULL,
      ADD COLUMN source varchar(16) NOT NULL DEFAULT 'partner',
      ADD COLUMN submitted_by_team_id uuid CONSTRAINT briefs_originating_team_fk REFERENCES teams(id),
      ADD COLUMN share_with_teams boolean NOT NULL DEFAULT false`);
    await q.query(`CREATE UNIQUE INDEX brief_team_origin_unique ON briefs(submitted_by_team_id) WHERE source='team' AND deleted_at IS NULL`);
    await q.query(`ALTER TABLE teams ADD COLUMN programme_resources_brief_id uuid, ADD COLUMN programme_resources_issued_at timestamptz, ADD COLUMN programme_resources_issued_by uuid`);
    await q.query(`CREATE TABLE team_brief_details (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      brief_id uuid NOT NULL CONSTRAINT team_brief_details_brief_fk REFERENCES briefs(id) ON DELETE CASCADE, answers jsonb NOT NULL DEFAULT '{}', file_urls jsonb NOT NULL DEFAULT '[]',
      submitted_by uuid, contact_verified_by_staff boolean NOT NULL DEFAULT false, schema_version integer NOT NULL DEFAULT 1, history jsonb NOT NULL DEFAULT '[]')`);
    await q.query(`CREATE UNIQUE INDEX team_brief_details_brief_id ON team_brief_details(brief_id)`);
    // Priority is derived data. Keep impact independent from fit in both old and new records.
    await q.query(`UPDATE briefs SET priority_score=COALESCE(fit_score,0)-CASE WHEN NULLIF(score_override,'') IS NOT NULL THEN 50 ELSE 0 END`);
    // Preserve every historical stage/submission. New fixed steps get their own IDs and
    // inherit existing cohort dates; no dates from ATF's draft slides are embedded here.
    const cohorts = await q.query(`SELECT c.id, c.deadlines, j.deadline AS joining, l.deadline AS certification,
      (SELECT deadline FROM stages s WHERE s.cohort_id=c.id AND s.number=1 AND s.deleted_at IS NULL ORDER BY s.created_at LIMIT 1) AS first_deadline,
      (SELECT deadline FROM stages s WHERE s.cohort_id=c.id AND s.number=2 AND s.deleted_at IS NULL ORDER BY s.created_at LIMIT 1) AS second_deadline,
      (SELECT deadline FROM stages s WHERE s.cohort_id=c.id AND s.number=3 AND s.deleted_at IS NULL ORDER BY s.created_at LIMIT 1) AS third_deadline
      FROM cohorts c LEFT JOIN stages j ON j.id=c.team_joining_stage_id LEFT JOIN stages l ON l.id=c.learning_certification_stage_id`);
    for (const c of cohorts) {
      const d = c.deadlines || {};
      const fallback = c.third_deadline || d.demoDay || c.second_deadline || c.first_deadline || new Date();
      const specs = [
        ["team", "Form a team", c.joining || d.teamFormationEnd || c.first_deadline || fallback],
        ["problem", "Choose a problem", d.briefSelectionEnd || c.first_deadline || fallback],
        ["proposal", "Submit a proposal", c.certification || d.learningCertificationEnd || c.first_deadline || fallback],
        ["evaluation", "Pass evaluation", c.second_deadline || d.stage2End || fallback],
        ["build", "Build and submit", c.third_deadline || d.stage3End || d.demoDay || fallback],
      ];
      const ids: string[] = [];
      for (const [i, [key, name, deadline]] of specs.entries()) {
        const rows = await q.query(`INSERT INTO stages(cohort_id,number,name,type,deadline,requirements,weight_percentage,is_active,allow_late_submissions,late_penalty_percentage,sort_order,workflow_key,requires_manual_approval)
          VALUES($1,$2,$3,'mixed',$4,$5,0,true,false,0,$2,$6,$7) RETURNING id`,
          [c.id, i + 1, name, deadline, key === "build" ? { documentRequired: true, githubRequired: true, videoRequired: true, videoMaxSize: 100 } : key === "team" ? { legacyDeadlineStageId: (await q.query("SELECT team_joining_stage_id AS id FROM cohorts WHERE id=$1", [c.id]))[0].id } : key === "proposal" ? { legacyDeadlineStageId: (await q.query("SELECT learning_certification_stage_id AS id FROM cohorts WHERE id=$1", [c.id]))[0].id } : {}, key, key === "proposal"]);
        ids.push(rows[0].id);
      }
      await q.query(`UPDATE cohorts SET team_joining_stage_id=$2, learning_certification_stage_id=$3 WHERE id=$1`, [c.id, ids[0], ids[2]]);
    }
  }
  async down(q: QueryRunner): Promise<void> {
    // Never discard submitted work or community briefs during a rollback.
    const [{ count }] = await q.query(`SELECT (SELECT count(*) FROM submissions x JOIN stages s ON s.id=x.stage_id WHERE s.workflow_key IS NOT NULL) + (SELECT count(*) FROM briefs WHERE source='team') AS count`);
    if (Number(count)) throw new Error("Cannot revert ATF workflow while team briefs or workflow submissions exist");
    await q.query(`UPDATE cohorts c SET team_joining_stage_id=(SELECT (s.requirements->>'legacyDeadlineStageId')::uuid FROM stages s WHERE s.cohort_id=c.id AND s.workflow_key='team'), learning_certification_stage_id=(SELECT (s.requirements->>'legacyDeadlineStageId')::uuid FROM stages s WHERE s.cohort_id=c.id AND s.workflow_key='proposal')`);
    await q.query(`DELETE FROM stages WHERE workflow_key IS NOT NULL`);
    await q.query(`DROP TABLE team_brief_details`);
    await q.query(`UPDATE briefs SET priority_score=COALESCE(fit_score,0)+COALESCE(impact_score,0)*10-CASE WHEN NULLIF(score_override,'') IS NOT NULL THEN 50 ELSE 0 END`);
    await q.query(`DROP INDEX brief_team_origin_unique`);
    await q.query(`ALTER TABLE teams DROP COLUMN programme_resources_brief_id, DROP COLUMN programme_resources_issued_at, DROP COLUMN programme_resources_issued_by`);
    await q.query(`ALTER TABLE briefs DROP COLUMN source, DROP COLUMN submitted_by_team_id, DROP COLUMN share_with_teams, ALTER COLUMN organization_id SET NOT NULL`);
    await q.query(`DROP INDEX stages_cohort_workflow_key`);
    await q.query(`ALTER TABLE stages DROP COLUMN workflow_key`);
  }
}
