import { MigrationInterface, QueryRunner } from 'typeorm';

/** Keep existing duplicate names intact while reserving every occupied name atomically. */
export class UniqueTeamNames1795737800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE teams IN SHARE ROW EXCLUSIVE MODE;
      CREATE OR REPLACE FUNCTION acmp_team_name_key(value text) RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT lower(btrim(regexp_replace(value, '[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', ' ', 'g')))
      $$;
      CREATE TABLE team_name_claims (
        cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        name_key text NOT NULL,
        active_team_count integer NOT NULL CHECK (active_team_count >= 0),
        CONSTRAINT team_names_cohort_key PRIMARY KEY (cohort_id, name_key)
      );
      INSERT INTO team_name_claims (cohort_id, name_key, active_team_count)
      SELECT cohort_id, acmp_team_name_key(name), count(*)::integer
      FROM teams WHERE deleted_at IS NULL GROUP BY cohort_id, acmp_team_name_key(name);

      CREATE OR REPLACE FUNCTION acmp_claim_team_name() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' THEN
          IF OLD.deleted_at IS NULL AND OLD.cohort_id = NEW.cohort_id
            AND acmp_team_name_key(OLD.name) = acmp_team_name_key(NEW.name)
          THEN RETURN NEW; END IF;
        END IF;
        IF char_length(btrim(regexp_replace(NEW.name, '[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', ' ', 'g'))) NOT BETWEEN 2 AND 100 THEN
          RAISE EXCEPTION 'Team names must contain between 2 and 100 characters.' USING ERRCODE = '23514';
        END IF;
        INSERT INTO team_name_claims (cohort_id, name_key, active_team_count)
        VALUES (NEW.cohort_id, acmp_team_name_key(NEW.name), 1);
        RETURN NEW;
      END $$;
      CREATE OR REPLACE FUNCTION acmp_release_team_name() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE remaining integer;
      BEGIN
        IF OLD.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
        IF TG_OP = 'UPDATE' THEN
          IF NEW.deleted_at IS NULL AND OLD.cohort_id = NEW.cohort_id
            AND acmp_team_name_key(OLD.name) = acmp_team_name_key(NEW.name)
          THEN RETURN NULL; END IF;
        END IF;
        UPDATE team_name_claims SET active_team_count = active_team_count - 1
        WHERE cohort_id = OLD.cohort_id AND name_key = acmp_team_name_key(OLD.name)
        RETURNING active_team_count INTO remaining;
        IF remaining = 0 THEN
          DELETE FROM team_name_claims WHERE cohort_id = OLD.cohort_id AND name_key = acmp_team_name_key(OLD.name);
        END IF;
        RETURN NULL;
      END $$;
      CREATE TRIGGER teams_claim_name BEFORE INSERT OR UPDATE OF name, cohort_id, deleted_at ON teams
      FOR EACH ROW EXECUTE FUNCTION acmp_claim_team_name();
      CREATE TRIGGER teams_release_name AFTER DELETE OR UPDATE OF name, cohort_id, deleted_at ON teams
      FOR EACH ROW EXECUTE FUNCTION acmp_release_team_name();
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TRIGGER teams_release_name ON teams;
      DROP TRIGGER teams_claim_name ON teams;
      DROP FUNCTION acmp_release_team_name();
      DROP FUNCTION acmp_claim_team_name();
      DROP TABLE team_name_claims;
      DROP FUNCTION acmp_team_name_key(text);
    `);
  }
}
