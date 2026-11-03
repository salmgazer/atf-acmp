import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/** One-time adoption of migrations for a verified, legacy synchronized dev DB. */
async function baseline() {
  if (process.env.NODE_ENV !== 'development' || !process.argv.includes('--acknowledge-existing-schema')) throw new Error('Baseline requires development mode and --acknowledge-existing-schema');
  const db = new DataSource({ ...dataSourceOptions, logging: false });
  await db.initialize();
  try {
    const [ledger] = await db.query("SELECT to_regclass('public.migrations') AS name");
    if (ledger.name) throw new Error('Migration history already exists; use migration:run');
    const drift = await db.driver.createSchemaBuilder().log();
    // Never replay the initial schema or silently adopt unrelated schema drift.
    const expected = [
      /^ALTER TABLE "stages" ADD "evaluation_criteria" jsonb$/,
      /^DROP INDEX "public"\."IDX_cc337ab94ccb21ee6e6411dcb8"$/,
      /^ALTER TABLE "scheduled_sessions" (DROP COLUMN "scheduled_at"|ADD "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL)$/,
      /^CREATE UNIQUE INDEX "(team_one_active_mentor_claim|team_member_one_confirmed_team|evaluation_one_active_job)" /,
      /^CREATE INDEX "IDX_cc337ab94ccb21ee6e6411dcb8" /,
    ];
    const unexpected = drift.upQueries.filter(query => !expected.some(pattern => pattern.test(query.query)));
    if (unexpected.length) throw new Error('Legacy schema differs from the reviewed baseline; inspect schema before adoption: ' + unexpected.map(item => item.query).join('; '));
    const required = db.entityMetadatas.filter(entity => entity.tableName !== 'typeorm_metadata');
    for (const entity of required) {
      const [table] = await db.query('SELECT to_regclass($1) AS name', ['public.' + entity.tableName]);
      if (!table.name) throw new Error('Missing baseline table: ' + entity.tableName);
    }
    await db.transaction(async manager => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext('acmp-migration-baseline'))");
      await manager.query('CREATE TABLE migrations (id SERIAL PRIMARY KEY, timestamp bigint NOT NULL, name varchar NOT NULL)');
      await manager.query('INSERT INTO migrations(timestamp,name) VALUES ($1,$2)', [1720540000000, 'InitialSchema1720540000000']);
    });
    console.log('Verified legacy initial schema recorded. Run migration:run to apply the pending forward migrations.');
  } finally { await db.destroy(); }
}
baseline().catch(error => { console.error(error.message); process.exitCode = 1; });
