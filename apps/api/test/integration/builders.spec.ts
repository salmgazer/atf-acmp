import "reflect-metadata";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import * as path from "path";
import * as Papa from "papaparse";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Team, TeamMember, TeamMemberStatus } from "@/database/entities/team.entity";
import { User, Role } from "@/database/entities/user.entity";
import { BuilderBroadcast } from "@/database/entities/builder-broadcast.entity";
import { BuildersService } from "@/modules/participants/builders.service";
import { BuilderBroadcastProcessor } from "@/modules/participants/builder-broadcast.processor";
import { BuilderBroadcastDto, BuilderFiltersDto, BuilderQueryDto } from "@/modules/participants/dto/builders.dto";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Staff builders and durable broadcasts in PostgreSQL", () => {
  let db: DataSource, service: BuildersService, processor: BuilderBroadcastProcessor, cohort: Cohort, actor: User;
  const queue = { add: jest.fn(), getJob: jest.fn(), setGlobalConcurrency: jest.fn() };
  const email = { requireDeliveryConfiguration: jest.fn(), sendBuilderBroadcastEmail: jest.fn() };
  const filters = (extra = {}) => plainToInstance(BuilderFiltersDto, { cohortId: cohort.id, ...extra });
  const query = (extra = {}) => plainToInstance(BuilderQueryDto, { cohortId: cohort.id, ...extra });
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
    service = new BuildersService(db, queue as any, email as any);
    processor = new BuilderBroadcastProcessor(db, service, email as any);
  }, 120000);
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const fn of Object.values(queue)) fn.mockReset().mockResolvedValue(undefined);
    for (const fn of Object.values(email)) fn.mockReset();
    email.sendBuilderBroadcastEmail.mockResolvedValue(undefined);
    cohort = await db.getRepository(Cohort).save({ name: "Builder regression " + randomUUID(), status: "active" as any, groups: ["North", "South"], countries: ["Ghana", "Nigeria"] });
    actor = await db.getRepository(User).save({ email: `${randomUUID()}@example.test`, role: Role.PROGRAM_MANAGER, isActive: true });
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  function participant(extra: Partial<Participant> = {}) {
    const id = randomUUID();
    return db.getRepository(Participant).save({ participantId: id, email: `${id}@example.test`, firstName: "Example", lastName: "Builder", country: "Ghana", cohortId: cohort.id, status: ParticipantStatus.READY, group: "North", preferredLanguage: "JavaScript", languageProficiency: "Beginner", developmentExperience: true, testingExperience: true, deploymentExperience: true, builderConfirm: true, ...extra });
  }
  async function broadcast(extra = {}) {
    const audience = await service.audience(filters());
    const dto = plainToInstance(BuilderBroadcastDto, { requestId: randomUUID(), filters: filters(), audienceHash: audience.audienceHash, subject: "Builder update", message: "Please review your matching profile.", ...extra });
    return { dto, batch: await service.broadcast(dto, actor.id) };
  }

  it("includes qualified beginners, migrated builders and unconfirmed Builder roles, but excludes withdrawn or non-builders", async () => {
    const beginner = await participant({ firstName: "Beginner" });
    const migrated = await participant({ firstName: "Migrated", builderConfirm: false });
    const unanswered = await participant({ firstName: "Unanswered", builderConfirm: false, developmentExperience: null, testingExperience: null, deploymentExperience: null });
    await db.getRepository(ParticipantPreference).save({ participantId: unanswered.id, preferredRole: "builder" });
    await participant({ developmentExperience: false });
    await participant({ status: ParticipantStatus.INACTIVE });
    await participant({ programmeOptedOut: true });
    const deleted = await participant(); await db.getRepository(Participant).softDelete(deleted.id);
    const result = await service.list(query({ limit: 2 }));
    expect(result).toMatchObject({ total: 3, totalPages: 2, summary: { confirmed: 1, pending: 2, unassigned: 3 } });
    const all = [...result.data, ...(await service.list(query({ limit: 2, page: 2 }))).data];
    expect(all.map(p => p.id).sort()).toEqual([beginner.id, migrated.id, unanswered.id].sort());
    expect(all.find(p => p.id === beginner.id)?.languageProficiency).toBe("Beginner");
    expect((await service.list(query({ confirmation: "confirmed" }))).data.map(p => p.id)).toEqual([beginner.id]);
  });

  it("uses only current confirmed memberships and filters Group, country, assignment and confirmation consistently", async () => {
    const assigned = await participant({ firstName: "Assigned" }), pending = await participant({ group: "South", country: "Nigeria", builderConfirm: false });
    const team = await db.getRepository(Team).save({ cohortId: cohort.id, group: "North", name: "Working team", inviteCode: randomUUID() });
    const pendingTeam = await db.getRepository(Team).save({ cohortId: cohort.id, group: "South", name: "Pending team", inviteCode: randomUUID() });
    await db.getRepository(TeamMember).save([{ participantId: assigned.id, teamId: team.id, status: TeamMemberStatus.CONFIRMED }, { participantId: pending.id, teamId: pendingTeam.id, status: TeamMemberStatus.PENDING }]);
    const found = await service.list(query({ assignment: "assigned", group: "North", search: "Assigned Builder" }));
    expect(found).toMatchObject({ total: 1, data: [{ id: assigned.id, teamId: team.id, teamName: "Working team", group: "North" }] });
    expect((await service.list(query({ assignment: "unassigned", confirmation: "pending", country: "Nigeria", group: "South" }))).data).toMatchObject([{ id: pending.id, teamId: null }]);
    await db.getRepository(Team).softDelete(team.id);
    expect((await service.list(query({ assignment: "assigned" }))).total).toBe(0);
    await expect(service.list(query({ group: "North", ungrouped: true }))).rejects.toThrow("Choose a group");
  });

  it("exports all matching pages, contact and assignment fields, and safely escapes CSV spreadsheet formulas", async () => {
    const first = await participant({ firstName: '=HYPERLINK("https://example.test")', group: "South", preferredLanguage: "Other", otherLanguage: "Elixir" });
    await participant({ builderConfirm: false, group: "South" });
    await participant({ group: "North" });
    expect((await service.list(query({ group: "South", limit: 1 }))).totalPages).toBe(2);
    const exported = await service.export(filters({ group: "South" }));
    const result = Papa.parse<Record<string, string>>(exported.csv, { header: true }).data;
    expect(exported.total).toBe(2);
    expect(result).toHaveLength(2);
    expect(result.find(p => p.Email === first.email)).toMatchObject({ "First name": '\'=HYPERLINK("https://example.test")', Group: "South", Team: "", Assignment: "Not assigned", "Preferred language": "Elixir", Proficiency: "Beginner", "Builder confirmation": "Confirmed" });
    expect((await service.audience(filters({ group: "South" }))).total).toBe(2);
  });

  it("requires a reviewed, current recipient snapshot and avoids accepting duplicate broadcasts", async () => {
    await participant();
    const audience = await service.audience(filters());
    await participant();
    const dto = plainToInstance(BuilderBroadcastDto, { requestId: randomUUID(), filters: filters(), audienceHash: audience.audienceHash, subject: "Update", message: "Hello builders" });
    await expect(service.broadcast(dto, actor.id)).rejects.toThrow("list changed");
    dto.audienceHash = (await service.audience(filters())).audienceHash;
    const first = await service.broadcast(dto, actor.id), retry = await service.broadcast(dto, actor.id);
    expect(retry.id).toBe(first.id); expect(queue.add).toHaveBeenCalledTimes(1);
    await expect(service.broadcast({ ...dto, message: "Different content" }, actor.id)).rejects.toThrow("already been used");
    await expect(service.broadcast(dto, randomUUID())).rejects.toThrow("already been used");
  });

  it("persists broadcasts during Redis failure and requeues them from PostgreSQL after total queue loss", async () => {
    const p = await participant(); queue.add.mockRejectedValue(new Error("Redis unavailable"));
    const { batch } = await broadcast();
    expect(batch).toMatchObject({ state: "queued", total: 1 });
    expect((await db.getRepository(BuilderBroadcast).findOneByOrFail({ id: batch.id })).recipients).toMatchObject([{ id: p.id, email: p.email }]);
    queue.add.mockReset().mockResolvedValue(undefined); queue.getJob.mockResolvedValue(undefined);
    await service.recover();
    expect(queue.add).toHaveBeenCalledWith("send", { batchId: batch.id }, expect.objectContaining({ jobId: batch.id }));
    await processor.process({ data: { batchId: batch.id } } as any);
    expect(await service.status(batch.id)).toMatchObject({ state: "completed", processed: 1, sent: 1 });
    await processor.process({ data: { batchId: batch.id } } as any);
    expect(email.sendBuilderBroadcastEmail).toHaveBeenCalledTimes(1);
  });

  it("skips changed addresses and opt-outs at delivery, and records actual delivery failures", async () => {
    const optedOut = await participant(), changed = await participant(), failed = await participant();
    const { batch } = await broadcast();
    await db.getRepository(Participant).update(optedOut.id, { programmeOptedOut: true });
    await db.getRepository(Participant).update(changed.id, { email: `${randomUUID()}@example.test` });
    email.sendBuilderBroadcastEmail.mockRejectedValue(new Error("Provider unavailable"));
    await processor.process({ data: { batchId: batch.id } } as any);
    expect(await service.status(batch.id)).toMatchObject({ state: "completed", total: 3, processed: 3, sent: 0, failed: 1, skipped: 2, failures: [{ participantId: failed.participantId }] });
    expect(email.sendBuilderBroadcastEmail).toHaveBeenCalledTimes(1);
    expect(email.sendBuilderBroadcastEmail.mock.calls[0][0].to).toBe(failed.email);
  });

  it("resumes after a worker interruption without replaying recipients already checkpointed in PostgreSQL", async () => {
    const first = await participant(), second = await participant();
    const { batch } = await broadcast();
    const runner = db.createQueryRunner();
    const update = runner.manager.update.bind(runner.manager);
    jest.spyOn(runner.manager, "update").mockImplementation(async (...args: any[]) => {
      const result = await (update as any)(...args);
      if (args[2]?.progress?.processed === 1) throw new Error("Worker interrupted after durable checkpoint");
      return result;
    });
    jest.spyOn(db, "createQueryRunner").mockReturnValueOnce(runner);
    await expect(processor.process({ data: { batchId: batch.id } } as any)).rejects.toThrow("interrupted");
    expect(await service.status(batch.id)).toMatchObject({ state: "active", processed: 1, sent: 1 });
    jest.restoreAllMocks();
    await processor.process({ data: { batchId: batch.id } } as any);
    expect(await service.status(batch.id)).toMatchObject({ state: "completed", processed: 2, sent: 2 });
    expect(email.sendBuilderBroadcastEmail.mock.calls.map(([message]) => message.to).sort()).toEqual([first.email, second.email].sort());
  });

  it("rejects invalid filters, missing recipient scope, blank messages and subject header injection", async () => {
    const valid = { requestId: randomUUID(), filters: {}, audienceHash: "a".repeat(64), subject: "Update", message: "Hello" };
    for (const bad of [{ filters: undefined }, { filters: [] }, { subject: "Update\r\nBcc: other@example.test" }, { subject: "   " }, { message: " " }, { filters: { confirmation: "anything" } }]) {
      expect((await validate(plainToInstance(BuilderBroadcastDto, { ...valid, ...bad }))).length).toBeGreaterThan(0);
    }
    expect(await validate(plainToInstance(BuilderBroadcastDto, valid))).toEqual([]);
  });
});
