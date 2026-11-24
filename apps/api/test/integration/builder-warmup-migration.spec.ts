import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { LanguageNeutralBuildersAndWarmup1795478400000 } from "@/database/migrations/1795478400000-LanguageNeutralBuildersAndWarmup";
const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Language-neutral builder and six-step migration", () => {
  let admin: DataSource, db: DataSource, database: string;
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Disposable regression cluster required");
    database = `acmp_regression_builders_${randomUUID().replace(/-/g, "").slice(0, 12)}_test`;
    url.pathname = "/postgres"; admin = await new DataSource({ type: "postgres", url: url.toString() }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`); url.pathname = `/${database}`;
    db = await new DataSource({ type: "postgres", url: url.toString(), entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")] }).initialize();
    db.migrations = db.migrations.filter(m => !m.constructor.name.startsWith("LanguageNeutralBuildersAndWarmup")); await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); if (admin?.isInitialized) { if (database) await admin.query(`DROP DATABASE "${database}"`); await admin.destroy(); } });
  it("retains every previously qualified builder, dates, IDs, submissions and proposal records", async () => {
    const cohort = randomUUID(); await db.query("INSERT INTO cohorts(id,name) VALUES($1,'Builder migration fixture')", [cohort]);
    const cases = [
      ["Intermediate — functions", "confident", false, true], ["Advanced", "confident", false, true], ["Expert: deploy", "confident", false, true],
      ["Beginner", "no", true, true], [null, null, true, true], ["Expert", "with_support", false, false],
      ["Intermediate-ish", "confident", false, true], ["Advancedish", "confident", false, false], ["Beginner", "confident", false, false], ["Beginner", "no", false, false],
    ];
    const people: string[] = [];
    for (const [caseIndex, [python, ability, labs]] of cases.entries()) {
      const id = randomUUID(); people.push(id);
      await db.query("INSERT INTO participants(id,participant_id,email,first_name,last_name,country,cohort_id,python_skill,code_labs_completed,skills) VALUES($1::uuid,$1::text,$2,'Test','Learner','Ghana',$3,$4,$5,$6)", [id, `${id}@example.test`, cohort, python, labs, JSON.stringify(caseIndex === 1 ? ['JavaScript'] : caseIndex === 2 ? ['Python','JavaScript/TypeScript'] : caseIndex === 3 ? ['R'] : caseIndex === 9 ? ['Java'] : [])]);
      await db.query("INSERT INTO participant_preferences(participant_id,build_deploy_ability) VALUES($1,$2)", [id, ability]);
    }
    const stageIds: string[] = [];
    for (const [i, key] of ["team", "problem", "proposal", "evaluation", "build"].entries()) {
      const id = randomUUID(); stageIds.push(id); await db.query("INSERT INTO stages(id,cohort_id,workflow_key,number,name,deadline,requires_manual_approval) VALUES($1,$2,$3::varchar,$4,$3::varchar,'2040-02-01T23:59Z',$5)", [id, cohort, key, i + 1, key === "proposal"]);
    }
    await db.query("UPDATE cohorts SET team_joining_stage_id=$2,learning_certification_stage_id=$3 WHERE id=$1", [cohort, stageIds[0], stageIds[2]]);
    const briefId = randomUUID(), teamId = randomUUID(), proposalId = randomUUID();
    await db.query("INSERT INTO briefs(id,cohort_id,title,description,problem_statement,expected_outcomes,data_description,status) VALUES($1,$2,'Test brief','Description','Problem','Outcome','Data','approved')", [briefId, cohort]);
    await db.query("INSERT INTO teams(id,name,cohort_id,invite_code,brief_id) VALUES($1,'Existing team',$2,$3,$4)", [teamId, cohort, randomUUID(), briefId]);
    await db.query("INSERT INTO submissions(id,team_id,stage_id,content,status,submitted_at,approved_at) VALUES($1,$2,$3,$4,'approved',now(),now())", [proposalId, teamId, stageIds[2], { briefId, text: "Preserve this proposal" }]);
    const [originalProposal] = await db.query("SELECT * FROM submissions WHERE id=$1", [proposalId]);
    db.migrations.push(new LanguageNeutralBuildersAndWarmup1795478400000()); await db.runMigrations();
    for (const [i, id] of people.entries()) {
      const [p] = await db.query("SELECT * FROM participants WHERE id=$1", [id]);
      expect([p.development_experience, p.testing_experience, p.deployment_experience]).toEqual(cases[i][3] ? [true, true, true] : [null, null, null]);
      expect(p.builder_confirm).toBe(false); expect(p.python_skill).toBe(cases[i][0]);
      if (i === 0) expect(p).toMatchObject({ preferred_language: "Python", language_proficiency: "Intermediate" });
      if (i === 1) expect(p).toMatchObject({ preferred_language: "JavaScript", language_proficiency: null });
      if (i === 2) expect(p.preferred_language).toBeNull();
      if (i === 3) expect(p).toMatchObject({ preferred_language: "R", language_proficiency: null });
      if (i === 9) expect(p).toMatchObject({ preferred_language: "Java", language_proficiency: null });
      if (i === 4) expect(p.preferred_language).toBeNull();
    }
    const stages = await db.query("SELECT * FROM stages WHERE cohort_id=$1 ORDER BY number", [cohort]);
    expect(stages.map(s => s.workflow_key)).toEqual(["team", "problem", "proposal", "warmup", "evaluation", "build"]);
    expect(stages.filter(s => s.workflow_key !== "warmup").map(s => s.id)).toEqual(stageIds);
    expect(stages.every(s => s.deadline.toISOString() === "2040-02-01T23:59:00.000Z")).toBe(true);
    expect(stages[3]).toMatchObject({ requires_ai_evaluation: true, requires_manual_approval: false, requirements: {} });
    expect(stages[2].requires_manual_approval).toBe(false);
    expect((await db.query("SELECT team_joining_stage_id,learning_certification_stage_id FROM cohorts WHERE id=$1", [cohort]))[0]).toEqual({ team_joining_stage_id: stageIds[0], learning_certification_stage_id: stageIds[2] });
    expect((await db.driver.createSchemaBuilder().log()).upQueries.map(q => q.query)).toEqual([]);
    expect((await db.query("SELECT * FROM submissions WHERE id=$1", [proposalId]))[0]).toEqual(originalProposal);
    expect(await db.runMigrations()).toEqual([]);
    await expect(db.undoLastMigration()).rejects.toThrow("must be preserved");
  }, 120000);
});
