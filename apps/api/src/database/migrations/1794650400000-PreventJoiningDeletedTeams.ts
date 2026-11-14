import { MigrationInterface, QueryRunner } from "typeorm";

/** Serialize admissions with sole-lead deletion and reject stale joins afterward. */
export class PreventJoiningDeletedTeams1794650400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_team_member() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE team_cohort uuid; participant_cohort uuid; capacity integer; opted_out boolean;
      BEGIN
        IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        PERFORM 1 FROM participants WHERE id = NEW.participant_id FOR UPDATE;
        SELECT t.cohort_id, LEAST(5, c.team_size_max) INTO team_cohort, capacity FROM teams t
          JOIN cohorts c ON c.id = t.cohort_id WHERE t.id = NEW.team_id AND t.deleted_at IS NULL FOR UPDATE OF t;
        IF NOT FOUND THEN RAISE EXCEPTION 'Team is no longer available'; END IF;
        SELECT cohort_id, programme_opted_out INTO participant_cohort, opted_out FROM participants WHERE id = NEW.participant_id;
        IF opted_out AND NEW.deleted_at IS NULL THEN RAISE EXCEPTION 'Opted-out participants cannot join or stay in a team'; END IF;
        IF participant_cohort IS DISTINCT FROM team_cohort THEN RAISE EXCEPTION 'Participant and team must belong to the same cohort'; END IF;
        IF NEW.status = 'confirmed' AND NEW.deleted_at IS NULL AND
          (SELECT count(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'confirmed' AND deleted_at IS NULL AND id <> NEW.id) >= capacity THEN RAISE EXCEPTION 'Team has reached maximum capacity'; END IF;
        RETURN NEW;
      END $$`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_team_member() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE team_cohort uuid; participant_cohort uuid; capacity integer; opted_out boolean;
      BEGIN
        PERFORM 1 FROM participants WHERE id = NEW.participant_id FOR UPDATE;
        SELECT t.cohort_id, LEAST(5, c.team_size_max) INTO team_cohort, capacity FROM teams t
          JOIN cohorts c ON c.id = t.cohort_id WHERE t.id = NEW.team_id FOR UPDATE OF t;
        SELECT cohort_id, programme_opted_out INTO participant_cohort, opted_out FROM participants WHERE id = NEW.participant_id;
        IF opted_out AND NEW.deleted_at IS NULL THEN RAISE EXCEPTION 'Opted-out participants cannot join or stay in a team'; END IF;
        IF participant_cohort IS DISTINCT FROM team_cohort THEN RAISE EXCEPTION 'Participant and team must belong to the same cohort'; END IF;
        IF NEW.status = 'confirmed' AND NEW.deleted_at IS NULL AND
          (SELECT count(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'confirmed' AND deleted_at IS NULL AND id <> NEW.id) >= capacity THEN RAISE EXCEPTION 'Team has reached maximum capacity'; END IF;
        RETURN NEW;
      END $$`);
  }
}
