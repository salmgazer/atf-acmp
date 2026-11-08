import { MigrationInterface, QueryRunner } from "typeorm";
export class AddAtfTeamRules1794056400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE participants ADD COLUMN programme_opted_out boolean NOT NULL DEFAULT false, ADD COLUMN programme_opted_out_at timestamptz, ADD COLUMN programme_opt_out_reason text,
      ADD COLUMN code_labs_completed boolean NOT NULL DEFAULT false, ADD COLUMN code_labs_verified_at timestamptz, ADD COLUMN code_labs_verified_by uuid`);
    await q.query(`ALTER TABLE teams ADD COLUMN competition_country varchar(255), ADD COLUMN registered_at timestamptz, ADD COLUMN challenge_started_at timestamptz`);
    await q.query(`ALTER TABLE briefs ADD COLUMN problem_country varchar(255)`);
    await q.query(`UPDATE briefs b SET problem_country = o.country FROM organizations o WHERE o.id = b.organization_id AND o.country IS NOT NULL`);
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
  async down(q: QueryRunner): Promise<void> {
    await q.query(`CREATE OR REPLACE FUNCTION acmp_check_team_member() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE team_cohort uuid; participant_cohort uuid; capacity integer;
      BEGIN
        PERFORM 1 FROM participants WHERE id = NEW.participant_id FOR UPDATE;
        SELECT t.cohort_id, c.team_size_max INTO team_cohort, capacity FROM teams t JOIN cohorts c ON c.id = t.cohort_id WHERE t.id = NEW.team_id FOR UPDATE OF t;
        SELECT cohort_id INTO participant_cohort FROM participants WHERE id = NEW.participant_id;
        IF participant_cohort IS DISTINCT FROM team_cohort THEN RAISE EXCEPTION 'Participant and team must belong to the same cohort'; END IF;
        IF NEW.status = 'confirmed' AND NEW.deleted_at IS NULL AND (SELECT count(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'confirmed' AND deleted_at IS NULL AND id <> NEW.id) >= capacity THEN RAISE EXCEPTION 'Team has reached maximum capacity'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`ALTER TABLE briefs DROP COLUMN problem_country`);
    await q.query(`ALTER TABLE teams DROP COLUMN competition_country, DROP COLUMN registered_at, DROP COLUMN challenge_started_at`);
    await q.query(`ALTER TABLE participants DROP COLUMN programme_opted_out, DROP COLUMN programme_opted_out_at, DROP COLUMN programme_opt_out_reason, DROP COLUMN code_labs_completed, DROP COLUMN code_labs_verified_at, DROP COLUMN code_labs_verified_by`);
  }
}
