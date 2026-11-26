import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Cohort } from '@/database/entities/cohort.entity';
import { Team } from '@/database/entities/team.entity';
import { saveAutomaticallyNamedTeam } from '@/common/services/team-names';
import { UniqueTeamNames1795737800000 } from '@/database/migrations/1795737800000-UniqueTeamNames';

const url = process.env.ACMP_TEST_DATABASE_URL;
(url ? describe : describe.skip)('PostgreSQL team-name uniqueness', () => {
  let db: DataSource, cohort: Cohort;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(parsed.pathname) || !['localhost', '127.0.0.1', 'postgres'].includes(parsed.hostname)) throw Error('Disposable local regression database required');
    db = new DataSource({ type: 'postgres', url, entities: [path.join(__dirname, '../../src/database/entities/*.entity.ts')], migrations: [path.join(__dirname, '../../src/database/migrations/*.ts')], synchronize: false });
    await db.initialize(); await db.runMigrations();
  }, 120000);
  beforeEach(async () => { cohort = await db.getRepository(Cohort).save({ name: 'Synthetic name test ' + randomUUID() }); });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  const create = (name: string, cohortId = cohort.id) => db.getRepository(Team).save({ name, cohortId, inviteCode: randomUUID() });

  it.each(['impact nexus', '  IMPACT   Nexus  ', 'Impact\tNexus', 'Impact\u00a0Nexus'])('rejects a duplicate spelling %j within the cohort', async duplicate => {
    await create('Impact Nexus');
    await expect(create(duplicate)).rejects.toMatchObject({ driverError: { code: '23505', constraint: 'team_names_cohort_key' } });
    expect(await db.getRepository(Team).countBy({ cohortId: cohort.id })).toBe(1);
  });
  it('allows the same name in a different cohort, but blocks moving it into an occupied cohort', async () => {
    const other = await db.getRepository(Cohort).save({ name: 'Other synthetic cohort' });
    const a = await create('Impact Nexus'); await create('Impact Nexus', other.id);
    await expect(db.getRepository(Team).update(a.id, { cohortId: other.id })).rejects.toMatchObject({ driverError: { code: '23505' } });
    expect((await db.getRepository(Team).findOneByOrFail({ id: a.id })).cohortId).toBe(cohort.id);
  });
  it('protects renames while allowing case-only changes and releasing an old name', async () => {
    const a = await create('Impact Nexus'), b = await create('Different Team');
    await db.getRepository(Team).update(a.id, { name: 'IMPACT  NEXUS' });
    await expect(db.getRepository(Team).update(b.id, { name: ' impact nexus ' })).rejects.toMatchObject({ driverError: { code: '23505' } });
    await db.getRepository(Team).update(a.id, { name: 'New name' });
    await expect(create('Impact Nexus')).resolves.toBeDefined();
  });
  it('releases a deleted name and rejects restoring it once the name is reused', async () => {
    const original = await create('Impact Nexus');
    await db.getRepository(Team).softDelete(original.id);
    const replacement = await create('Impact Nexus');
    await expect(db.getRepository(Team).restore(original.id)).rejects.toMatchObject({ driverError: { code: '23505' } });
    await db.getRepository(Team).delete(replacement.id);
    await db.getRepository(Team).restore(original.id);
    expect(await db.getRepository(Team).countBy({ cohortId: cohort.id })).toBe(1);
  });
  it('allows exactly one simultaneous claim, including raw SQL writers', async () => {
    const results = await Promise.allSettled(['Impact Nexus', 'IMPACT NEXUS', ' impact  nexus '].map(name => create(name)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) if (result.status === 'rejected') expect(result.reason.driverError).toMatchObject({ code: '23505', constraint: 'team_names_cohort_key' });
    expect(await db.query('SELECT active_team_count FROM team_name_claims WHERE cohort_id=$1', [cohort.id])).toEqual([{ active_team_count: 1 }]);
  });
  it('also protects fixed-snapshot transactions rather than relying on an application precheck', async () => {
    const runners = [db.createQueryRunner(), db.createQueryRunner()];
    try {
      for (const runner of runners) { await runner.connect(); await runner.startTransaction('REPEATABLE READ'); await runner.query('SELECT count(*) FROM teams'); }
      const results = await Promise.allSettled(runners.map(async runner => {
        try { await runner.manager.getRepository(Team).save({ name: 'Fixed snapshot', cohortId: cohort.id, inviteCode: randomUUID() }); await runner.commitTransaction(); }
        catch (error) { await runner.rollbackTransaction(); throw error; }
      }));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(await db.getRepository(Team).countBy({ cohortId: cohort.id })).toBe(1);
    } finally { for (const runner of runners) { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); } }
  });
  it('rolls name claims back with the rest of a failed creation', async () => {
    await expect(db.transaction(async manager => { await manager.getRepository(Team).save({ name: 'Rolled back', cohortId: cohort.id, inviteCode: randomUUID() }); throw Error('rollback test'); })).rejects.toThrow('rollback test');
    await expect(create('Rolled back')).resolves.toBeDefined();
  });
  it('recovers from a name being taken between an automatic preview and finalization', async () => {
    await create('Team 1'); await create('TEAM 2');
    const team = await db.transaction(manager => saveAutomaticallyNamedTeam(manager.getRepository(Team), manager.getRepository(Team).create({ name: 'Team 1', cohortId: cohort.id, inviteCode: randomUUID() })));
    expect(team.name).toBe('Team 3');
  });
  it('retries a concurrent manual claim using a savepoint without aborting formation', async () => {
    const team = await db.transaction(async manager => {
      const repository = manager.getRepository(Team), find = repository.find.bind(repository);
      jest.spyOn(repository, 'find').mockImplementationOnce(async options => {
        const names = await find(options);
        await create('Team 1');
        return names;
      });
      return saveAutomaticallyNamedTeam(repository, repository.create({ name: 'Team 1', cohortId: cohort.id, inviteCode: randomUUID() }));
    });
    expect(team.name).toBe('Team 2');
    expect(await db.getRepository(Team).countBy({ cohortId: cohort.id })).toBe(2);
  });
  it('preserves existing duplicate names during migration and reserves them until the last owner leaves', async () => {
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
    const schema = 'team_names_legacy_' + randomUUID().replace(/-/g, '');
    try {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET LOCAL search_path TO "${schema}"`);
      await runner.query('CREATE TABLE cohorts (id uuid PRIMARY KEY); CREATE TABLE teams (id uuid PRIMARY KEY, cohort_id uuid NOT NULL, name text NOT NULL, deleted_at timestamptz)');
      const id = randomUUID(), a = randomUUID(), b = randomUUID();
      await runner.query('INSERT INTO cohorts VALUES ($1)', [id]);
      await runner.query("INSERT INTO teams VALUES ($1,$3,'Legacy Team',NULL),($2,$3,' legacy  TEAM ',NULL)", [a, b, id]);
      const migration = new UniqueTeamNames1795737800000(); await migration.up(runner);
      expect(await runner.query('SELECT name FROM teams ORDER BY name')).toEqual([{ name: ' legacy  TEAM ' }, { name: 'Legacy Team' }]);
      expect(await runner.query('SELECT active_team_count FROM team_name_claims')).toEqual([{ active_team_count: 2 }]);
      async function rejectDuplicate() {
        await runner.query('SAVEPOINT collision');
        await expect(runner.query("INSERT INTO teams VALUES ($1,$2,'LEGACY TEAM',NULL)", [randomUUID(), id])).rejects.toMatchObject({ driverError: { code: '23505' } });
        await runner.query('ROLLBACK TO SAVEPOINT collision');
      }
      await rejectDuplicate(); await runner.query('DELETE FROM teams WHERE id=$1', [a]); await rejectDuplicate();
      await runner.query('DELETE FROM teams WHERE id=$1', [b]);
      await runner.query("INSERT INTO teams VALUES ($1,$2,'LEGACY TEAM',NULL)", [randomUUID(), id]);
      expect(await runner.query('SELECT active_team_count FROM team_name_claims')).toEqual([{ active_team_count: 1 }]);
      await migration.down(runner);
      expect((await runner.query("SELECT to_regclass('team_name_claims') AS name"))[0].name).toBeNull();
    } finally { await runner.rollbackTransaction(); await runner.release(); }
  });
  it('includes a team committed concurrently while the migration is waiting for writers', async () => {
    const migration = db.createQueryRunner(), writer = db.createQueryRunner();
    const schema = 'team_names_race_' + randomUUID().replace(/-/g, '');
    let pending: Promise<unknown> | undefined;
    try {
      await migration.connect(); await writer.connect();
      await migration.query(`CREATE SCHEMA "${schema}"`);
      await migration.query(`SET search_path TO "${schema}"`);
      await writer.query(`SET search_path TO "${schema}"`);
      await migration.query('CREATE TABLE cohorts (id uuid PRIMARY KEY); CREATE TABLE teams (id uuid PRIMARY KEY, cohort_id uuid NOT NULL, name text NOT NULL, deleted_at timestamptz)');
      const id = randomUUID(); await migration.query('INSERT INTO cohorts VALUES ($1)', [id]);
      await writer.startTransaction();
      await writer.query("INSERT INTO teams VALUES ($1,$2,'Team during migration',NULL)", [randomUUID(), id]);
      const [{ pid: writerPid }] = await writer.query('SELECT pg_backend_pid() AS pid');
      const [{ pid: migrationPid }] = await migration.query('SELECT pg_backend_pid() AS pid');
      await migration.startTransaction();
      pending = new UniqueTeamNames1795737800000().up(migration).then(() => null, error => error);
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        const [{ blockers }] = await db.query('SELECT pg_blocking_pids($1) AS blockers', [migrationPid]);
        if (blockers.includes(writerPid)) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await writer.commitTransaction();
      const result = await pending; if (result instanceof Error) throw result;
      await migration.commitTransaction();
      expect(await migration.query('SELECT name_key, active_team_count FROM team_name_claims')).toEqual([{ name_key: 'team during migration', active_team_count: 1 }]);
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await pending;
      if (migration.isTransactionActive) await migration.rollbackTransaction();
      await migration.query('RESET search_path'); await writer.query('RESET search_path');
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await writer.release(); await migration.release();
    }
  });
});
