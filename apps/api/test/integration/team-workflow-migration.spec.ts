import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { AtfTeamWorkflow1795020000000 } from "@/database/migrations/1795020000000-AtfTeamWorkflow";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Five-step migration preserves existing work", () => {
  let admin: DataSource, db: DataSource, database: string;
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Disposable regression cluster required");
    database = `acmp_regression_migration_${randomUUID().replace(/-/g, "").slice(0, 12)}_test`;
    url.pathname = "/postgres";
    admin = await new DataSource({ type: "postgres", url: url.toString() }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    url.pathname = `/${database}`;
    db = await new DataSource({ type: "postgres", url: url.toString(), entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")] }).initialize();
    db.migrations = db.migrations.filter(migration => ![/^AtfTeamWorkflow/, /^LanguageNeutralBuildersAndWarmup/].some(pattern => pattern.test(migration.name || migration.constructor.name)));
    await db.runMigrations();
  }, 120000);
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) { if (database) await admin.query(`DROP DATABASE "${database}"`); await admin.destroy(); }
  });
  it("retains stage/submission IDs, inherits configured dates, restores original bindings on rollback, and refuses destructive rollback", async () => {
    const cohortId = randomUUID(), teamId = randomUUID(), oldStages = [randomUUID(), randomUUID(), randomUUID()], submissionId = randomUUID();
    await db.query("INSERT INTO cohorts(id,name) VALUES($1,'Migration fixture')", [cohortId]);
    for (const [index, id] of oldStages.entries()) await db.query("INSERT INTO stages(id,cohort_id,number,name,deadline) VALUES($1,$2,$3,$4,$5)", [id, cohortId, index + 1, `Historical ${index + 1}`, `2040-0${index + 1}-15T23:59:00Z`]);
    await db.query("UPDATE cohorts SET team_joining_stage_id=$2,learning_certification_stage_id=$3 WHERE id=$1", [cohortId, oldStages[0], oldStages[1]]);
    await db.query("INSERT INTO teams(id,name,cohort_id,invite_code) VALUES($1,'Migration team',$2,$3)", [teamId, cohortId, randomUUID()]);
    await db.query("INSERT INTO submissions(id,team_id,stage_id,content,status) VALUES($1,$2,$3,$4,'submitted')", [submissionId, teamId, oldStages[0], { textContent: "Preserve this exact content" }]);
    db.migrations.push(new AtfTeamWorkflow1795020000000());
    await db.runMigrations();
    const stages = await db.query("SELECT * FROM stages WHERE cohort_id=$1 AND workflow_key IS NOT NULL ORDER BY number", [cohortId]);
    expect(stages.map(stage => stage.workflow_key)).toEqual(["team", "problem", "proposal", "evaluation", "build"]);
    expect(stages[0].deadline.toISOString()).toBe("2040-01-15T23:59:00.000Z");
    expect(stages[2].deadline.toISOString()).toBe("2040-02-15T23:59:00.000Z");
    expect(await db.query("SELECT id,stage_id,content FROM submissions WHERE id=$1", [submissionId])).toEqual([{ id: submissionId, stage_id: oldStages[0], content: { textContent: "Preserve this exact content" } }]);
    await db.undoLastMigration();
    expect((await db.query("SELECT team_joining_stage_id,learning_certification_stage_id FROM cohorts WHERE id=$1", [cohortId]))[0]).toEqual({ team_joining_stage_id: oldStages[0], learning_certification_stage_id: oldStages[1] });
    await db.runMigrations();
    const [{ id: proposalStage }] = await db.query("SELECT id FROM stages WHERE cohort_id=$1 AND workflow_key='proposal'", [cohortId]);
    await db.query("INSERT INTO submissions(team_id,stage_id,content) VALUES($1,$2,'{}')", [teamId, proposalStage]);
    await expect(db.undoLastMigration()).rejects.toThrow("Cannot revert ATF workflow");
    expect((await db.query("SELECT count(*) FROM submissions WHERE team_id=$1", [teamId]))[0].count).toBe("2");
  }, 120000);
});
