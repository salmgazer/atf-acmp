import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCohortGroups1793659200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE cohorts ADD COLUMN groups jsonb NOT NULL DEFAULT '[]'`);
    await q.query(`ALTER TABLE participants ADD COLUMN group_name varchar(100)`);
    await q.query(`ALTER TABLE teams ADD COLUMN group_name varchar(100)`);
    await q.query(`CREATE INDEX participant_cohort_group ON participants(cohort_id, group_name)`);
    await q.query(`CREATE INDEX team_cohort_group ON teams(cohort_id, group_name)`);
    await q.query(`CREATE FUNCTION acmp_validate_cohort_groups() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF jsonb_typeof(NEW.groups) <> 'array' OR jsonb_array_length(NEW.groups) > 100 OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(NEW.groups) item WHERE jsonb_typeof(item) <> 'string'
          OR length(btrim(item #>> '{}')) NOT BETWEEN 1 AND 100 OR item #>> '{}' <> btrim(item #>> '{}')
        ) OR (SELECT count(*) FROM jsonb_array_elements_text(NEW.groups)) <>
             (SELECT count(DISTINCT lower(item)) FROM jsonb_array_elements_text(NEW.groups) item)
        THEN RAISE EXCEPTION 'Groups must be unique nonempty names' USING ERRCODE = '23514'; END IF;
        IF EXISTS (SELECT 1 FROM participants p WHERE p.cohort_id = NEW.id AND p.deleted_at IS NULL
          AND p.group_name IS NOT NULL AND NOT (NEW.groups ? p.group_name)) OR EXISTS (
          SELECT 1 FROM teams t WHERE t.cohort_id = NEW.id AND t.deleted_at IS NULL
          AND t.group_name IS NOT NULL AND NOT (NEW.groups ? t.group_name))
        THEN RAISE EXCEPTION 'A group assigned to participants or teams cannot be removed' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_cohort_groups BEFORE INSERT OR UPDATE OF groups ON cohorts FOR EACH ROW EXECUTE FUNCTION acmp_validate_cohort_groups()`);
    await q.query(`CREATE FUNCTION acmp_validate_participant_group() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE tags jsonb;
      BEGIN
        IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        SELECT groups INTO tags FROM cohorts WHERE id = NEW.cohort_id FOR SHARE;
        IF NEW.group_name IS NOT NULL AND NOT (tags ? NEW.group_name)
        THEN RAISE EXCEPTION 'Participant group must belong to their cohort' USING ERRCODE = '23514'; END IF;
        IF jsonb_array_length(tags) > 0 AND NEW.group_name IS NULL AND
          (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL OR OLD.cohort_id IS DISTINCT FROM NEW.cohort_id)
        THEN RAISE EXCEPTION 'A group is required for participants in this cohort' USING ERRCODE = '23514'; END IF;
        IF TG_OP = 'UPDATE' AND (OLD.group_name IS DISTINCT FROM NEW.group_name OR OLD.cohort_id IS DISTINCT FROM NEW.cohort_id)
          AND EXISTS (SELECT 1 FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.participant_id = NEW.id
          AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND (t.group_name IS DISTINCT FROM NEW.group_name OR t.cohort_id <> NEW.cohort_id))
        THEN RAISE EXCEPTION 'Remove the participant from their team before changing group' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_participant_group BEFORE INSERT OR UPDATE ON participants FOR EACH ROW EXECUTE FUNCTION acmp_validate_participant_group()`);
    await q.query(`CREATE FUNCTION acmp_validate_team_group() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE tags jsonb;
      BEGIN
        IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        SELECT groups INTO tags FROM cohorts WHERE id = NEW.cohort_id FOR SHARE;
        IF (NEW.group_name IS NOT NULL AND NOT (tags ? NEW.group_name)) OR
          (TG_OP = 'INSERT' AND jsonb_array_length(tags) > 0 AND NEW.group_name IS NULL)
        THEN RAISE EXCEPTION 'Team group must belong to its cohort' USING ERRCODE = '23514'; END IF;
        IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM team_members m JOIN participants p ON p.id = m.participant_id
          WHERE m.team_id = NEW.id AND m.deleted_at IS NULL AND p.deleted_at IS NULL
          AND (p.group_name IS DISTINCT FROM NEW.group_name OR p.cohort_id <> NEW.cohort_id))
        THEN RAISE EXCEPTION 'Team members must share the team group' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_team_group BEFORE INSERT OR UPDATE OF group_name, cohort_id ON teams FOR EACH ROW EXECUTE FUNCTION acmp_validate_team_group()`);
    await q.query(`CREATE FUNCTION acmp_validate_group_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE participant_group text; team_group text; tags jsonb;
      BEGIN
        IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
        SELECT group_name INTO participant_group FROM participants WHERE id = NEW.participant_id FOR UPDATE;
        SELECT t.group_name, c.groups INTO team_group, tags FROM teams t JOIN cohorts c ON c.id = t.cohort_id WHERE t.id = NEW.team_id FOR UPDATE OF t;
        IF participant_group IS DISTINCT FROM team_group OR (jsonb_array_length(tags) > 0 AND team_group IS NULL)
        THEN RAISE EXCEPTION 'Team members must share the same assigned group' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE TRIGGER acmp_group_membership BEFORE INSERT OR UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION acmp_validate_group_membership()`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const [table, trigger, fn] of [
      ['team_members', 'acmp_group_membership', 'acmp_validate_group_membership'],
      ['teams', 'acmp_team_group', 'acmp_validate_team_group'],
      ['participants', 'acmp_participant_group', 'acmp_validate_participant_group'],
      ['cohorts', 'acmp_cohort_groups', 'acmp_validate_cohort_groups'],
    ]) {
      await q.query(`DROP TRIGGER ${trigger} ON ${table}`);
      await q.query(`DROP FUNCTION ${fn}()`);
    }
    await q.query(`DROP INDEX team_cohort_group`);
    await q.query(`DROP INDEX participant_cohort_group`);
    await q.query(`ALTER TABLE teams DROP COLUMN group_name`);
    await q.query(`ALTER TABLE participants DROP COLUMN group_name`);
    await q.query(`ALTER TABLE cohorts DROP COLUMN groups`);
  }
}
