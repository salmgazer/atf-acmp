import { MigrationInterface, QueryRunner } from "typeorm";

export class RepairStageEvaluationAndIntegrity1793577600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE stages
      ADD COLUMN IF NOT EXISTS requires_ai_evaluation boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS evaluation_prompt text,
      ADD COLUMN IF NOT EXISTS evaluation_criteria jsonb`);
    await q.query(`ALTER TABLE scheduled_sessions ALTER COLUMN scheduled_at TYPE timestamptz USING scheduled_at AT TIME ZONE 'UTC'`);
    await q.query(`ALTER TABLE evaluations ALTER COLUMN ai_weight SET DEFAULT 0.4`);
    // Do not silently remove conflicting production records. These indexes fail
    // the migration if existing data needs reconciliation before the rollout.
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS team_member_one_confirmed_team
      ON team_members(participant_id) WHERE status = 'confirmed' AND deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS team_one_active_mentor_claim
      ON mentor_claims(team_id) WHERE status = 'active' AND deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS evaluation_one_active_job
      ON evaluation_jobs(team_id, stage_id) WHERE status IN ('pending', 'processing') AND deleted_at IS NULL`);
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_team_member() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE team_cohort uuid; participant_cohort uuid; capacity integer;
      BEGIN
        PERFORM 1 FROM participants WHERE id = NEW.participant_id FOR UPDATE;
        SELECT t.cohort_id, c.team_size_max INTO team_cohort, capacity FROM teams t
          JOIN cohorts c ON c.id = t.cohort_id WHERE t.id = NEW.team_id FOR UPDATE OF t;
        SELECT cohort_id INTO participant_cohort FROM participants WHERE id = NEW.participant_id;
        IF participant_cohort IS DISTINCT FROM team_cohort THEN RAISE EXCEPTION 'Participant and team must belong to the same cohort'; END IF;
        IF NEW.status = 'confirmed' AND NEW.deleted_at IS NULL AND
          (SELECT count(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'confirmed'
           AND deleted_at IS NULL AND id <> NEW.id) >= capacity THEN RAISE EXCEPTION 'Team has reached maximum capacity'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_team_member_capacity BEFORE INSERT OR UPDATE ON team_members
      FOR EACH ROW EXECUTE FUNCTION acmp_check_team_member()`);
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_brief_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE brief_cohort uuid; capacity integer; approval text;
      BEGIN
        IF NEW.brief_id IS NULL OR NEW.deleted_at IS NOT NULL OR NEW.status = 'disqualified' THEN RETURN NEW; END IF;
        SELECT cohort_id, max_teams, status::text INTO brief_cohort, capacity, approval FROM briefs WHERE id = NEW.brief_id FOR UPDATE;
        IF brief_cohort IS DISTINCT FROM NEW.cohort_id OR approval <> 'approved' THEN RAISE EXCEPTION 'Brief must be approved in the team cohort'; END IF;
        IF (SELECT count(*) FROM teams WHERE brief_id = NEW.brief_id AND status <> 'disqualified'
          AND deleted_at IS NULL AND id <> NEW.id) >= capacity THEN RAISE EXCEPTION 'Brief has reached maximum capacity'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_brief_capacity BEFORE INSERT OR UPDATE OF brief_id, status, deleted_at ON teams
      FOR EACH ROW EXECUTE FUNCTION acmp_check_brief_assignment()`);
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_mentor_claim() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE mentor_cohort uuid; team_cohort uuid; capacity integer; mentor_state text;
      BEGIN
        IF NEW.status <> 'active' OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        SELECT cohort_id, max_claims, status::text INTO mentor_cohort, capacity, mentor_state FROM mentors WHERE id = NEW.mentor_id FOR UPDATE;
        SELECT cohort_id INTO team_cohort FROM teams WHERE id = NEW.team_id;
        IF team_cohort IS DISTINCT FROM mentor_cohort OR mentor_state <> 'active' THEN RAISE EXCEPTION 'Mentor must be active in the team cohort'; END IF;
        IF (SELECT count(*) FROM mentor_claims WHERE mentor_id = NEW.mentor_id AND status = 'active'
          AND deleted_at IS NULL AND id <> NEW.id) >= capacity THEN RAISE EXCEPTION 'Mentor has reached maximum capacity'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_mentor_claim_capacity BEFORE INSERT OR UPDATE ON mentor_claims
      FOR EACH ROW EXECUTE FUNCTION acmp_check_mentor_claim()`);
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_session_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE claim_state text; claim_team uuid; claim_mentor uuid;
      BEGIN
        IF NEW.status NOT IN ('scheduled', 'confirmed') OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        SELECT status::text, team_id, mentor_id INTO claim_state, claim_team, claim_mentor FROM mentor_claims WHERE id = NEW.claim_id FOR UPDATE;
        IF claim_state IS DISTINCT FROM 'active' OR claim_team IS DISTINCT FROM NEW.team_id OR claim_mentor IS DISTINCT FROM NEW.mentor_id THEN RAISE EXCEPTION 'Session must belong to an active claim'; END IF;
        IF (SELECT count(*) FROM scheduled_sessions WHERE claim_id = NEW.claim_id AND status IN ('scheduled', 'confirmed', 'completed') AND deleted_at IS NULL AND id <> NEW.id) >= 3 THEN RAISE EXCEPTION 'A claim supports at most three sessions'; END IF;
        PERFORM 1 FROM mentors WHERE id = NEW.mentor_id FOR UPDATE;
        IF NEW.duration_minutes <= 0 OR EXISTS (
          SELECT 1 FROM scheduled_sessions s WHERE s.mentor_id = NEW.mentor_id AND s.id <> NEW.id
          AND s.status IN ('scheduled', 'confirmed') AND s.deleted_at IS NULL
          AND s.scheduled_at < NEW.scheduled_at + make_interval(mins => NEW.duration_minutes)
          AND s.scheduled_at + make_interval(mins => s.duration_minutes) > NEW.scheduled_at
        ) THEN RAISE EXCEPTION 'Mentor session overlaps an existing booking'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_session_overlap BEFORE INSERT OR UPDATE ON scheduled_sessions
      FOR EACH ROW EXECUTE FUNCTION acmp_check_session_overlap()`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const [table, trigger, fn] of [
      ["scheduled_sessions", "acmp_session_overlap", "acmp_check_session_overlap"],
      ["mentor_claims", "acmp_mentor_claim_capacity", "acmp_check_mentor_claim"],
      ["teams", "acmp_brief_capacity", "acmp_check_brief_assignment"],
      ["team_members", "acmp_team_member_capacity", "acmp_check_team_member"],
    ]) {
      await q.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`);
      await q.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
    for (const index of ["team_member_one_confirmed_team", "team_one_active_mentor_claim", "evaluation_one_active_job"]) await q.query(`DROP INDEX IF EXISTS ${index}`);
    await q.query(`ALTER TABLE scheduled_sessions ALTER COLUMN scheduled_at TYPE timestamp USING scheduled_at AT TIME ZONE 'UTC'`);
    await q.query(`ALTER TABLE stages DROP COLUMN IF EXISTS evaluation_criteria, DROP COLUMN IF EXISTS evaluation_prompt, DROP COLUMN IF EXISTS requires_ai_evaluation`);
  }
}
