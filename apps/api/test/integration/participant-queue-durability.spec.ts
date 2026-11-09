import "reflect-metadata";
import { randomUUID } from "crypto";
import * as path from "path";
import * as Papa from "papaparse";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { User, Role } from "@/database/entities/user.entity";
import { ParticipantInviteBatchRecord } from "@/database/entities/participant-invite-batch.entity";
import { ParticipantImportBatch } from "@/database/entities/participant-import-batch.entity";
import { ParticipantInviteLedgerService } from "@/modules/participants/participant-invite-ledger.service";
import { ParticipantInvitesService, ParticipantInviteJob } from "@/modules/participants/participant-invites.service";
import { ParticipantInvitesProcessor } from "@/modules/participants/participant-invites.processor";
import { ParticipantImportService } from "@/modules/participants/participant-import.service";
import { ParticipantQueueRecoveryService } from "@/modules/participants/participant-queue-recovery.service";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL, redisUrl = process.env.ACMP_TEST_REDIS_URL;
(databaseUrl && redisUrl ? describe : describe.skip)("Participant queues recover from total Redis data loss", () => {
  let db: DataSource, redis: Redis, invites: ParticipantInvitesService, ledger: ParticipantInviteLedgerService, processor: ParticipantInvitesProcessor, imports: ParticipantImportService, recovery: ParticipantQueueRecoveryService;
  let inviteQueue: Queue<ParticipantInviteJob>, importQueue: Queue<{ batchId: string }>, cohort: Cohort, actor: User;
  let workers: Worker[] = [];
  const email = { requireDeliveryConfiguration: jest.fn(), sendParticipantInviteEmail: jest.fn(async (_message: unknown) => undefined) };
  beforeAll(async () => {
    const url = new URL(databaseUrl!), cache = new URL(redisUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost"].includes(url.hostname) || !["127.0.0.1", "localhost"].includes(cache.hostname) || !cache.port || cache.port === "6379") throw new Error("Requires disposable local PostgreSQL and a dedicated Redis container on a random port; FLUSHDB must never target application Redis");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
    redis = new Redis(redisUrl!);
    const connection = { host: cache.hostname, port: Number(cache.port), maxRetriesPerRequest: null };
    inviteQueue = new Queue(`durable-invites-${randomUUID()}`, { connection });
    importQueue = new Queue(`durable-imports-${randomUUID()}`, { connection });
    ledger = new ParticipantInviteLedgerService(db);
    invites = new ParticipantInvitesService(db.getRepository(Participant), inviteQueue, email as any, ledger);
    processor = new ParticipantInvitesProcessor(db.getRepository(Participant), email as any, new ConfigService({ FRONTEND_URL: "https://portal.example.test" }), ledger);
    imports = new ParticipantImportService(db, importQueue, invites);
    recovery = new ParticipantQueueRecoveryService(db, inviteQueue, importQueue, invites);
  }, 120000);
  beforeEach(async () => {
    email.sendParticipantInviteEmail.mockReset().mockResolvedValue(undefined);
    email.requireDeliveryConfiguration.mockReset();
    await redis.flushdb();
    await db.getRepository(ParticipantInviteBatchRecord).clear();
    await db.getRepository(ParticipantImportBatch).clear();
    cohort = await db.getRepository(Cohort).save({ name: "Durability " + randomUUID(), status: CohortStatus.ACTIVE, countries: ["Ghana"] });
    actor = await db.getRepository(User).save({ email: randomUUID() + "@example.test", role: Role.PROGRAM_MANAGER, isActive: true });
  });
  afterEach(async () => { await Promise.all(workers.map(worker => worker.close())); workers = []; jest.restoreAllMocks(); });
  afterAll(async () => { await Promise.all([inviteQueue?.close(), importQueue?.close(), redis?.quit()]); if (db?.isInitialized) await db.destroy(); });
  const participant = () => db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", firstName: "Example", lastName: "Learner", country: "Ghana", cohortId: cohort.id, status: ParticipantStatus.IMPORTED, mustChangePassword: true, onboardingComplete: false });
  async function eventually(check: () => Promise<boolean>) {
    const until = Date.now() + 10000;
    while (!(await check())) { if (Date.now() > until) throw new Error("Recovery did not finish in time"); await new Promise(resolve => setTimeout(resolve, 25)); }
  }

  it("accepts a batch durably when Redis publishing fails and restores it on reconciliation", async () => {
    const p = await participant();
    const publish = jest.spyOn(inviteQueue, "add").mockRejectedValueOnce(new Error("Redis unavailable"));
    const batch = await invites.resendSelected([p.id], actor.id);
    expect(batch).toMatchObject({ state: "queued", total: 1 });
    expect(await ledger.find(batch.id)).toMatchObject({ participantIds: [p.id] });
    publish.mockRestore();
    await recovery.reconcile();
    const worker = new Worker(inviteQueue.name, job => processor.process(job), { connection: { host: "127.0.0.1", port: Number(new URL(redisUrl!).port) } }); workers.push(worker);
    await eventually(async () => (await invites.status(batch.id)).state === "completed");
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(1);
    await redis.flushdb();
    expect(await invites.status(batch.id)).toMatchObject({ state: "completed", sent: 1 });
  });

  it("resumes at the PostgreSQL checkpoint after Redis is wiped, without replaying checkpointed recipients", async () => {
    const first = await participant(), second = await participant();
    const batch = await invites.resendSelected([first.id, second.id], actor.id);
    await eventually(async () => !!await inviteQueue.getJob(batch.id));
    const job = (await inviteQueue.getJob(batch.id))!;
    const checkpoint = ledger.checkpoint.bind(ledger);
    const crash = jest.spyOn(ledger, "checkpoint").mockImplementationOnce(async (...args) => { await checkpoint(...args); throw new Error("Worker terminated after checkpoint"); });
    await expect(processor.process(job)).rejects.toThrow("terminated");
    crash.mockRestore();
    expect(await ledger.status(batch.id)).toMatchObject({ processed: 1, sent: 1, state: "active" });
    const sentBefore = email.sendParticipantInviteEmail.mock.calls[0][0];
    await redis.flushdb();
    await recovery.reconcile();
    const recovered = (await inviteQueue.getJob(batch.id))!;
    expect(recovered.progress).toBe(0);
    await processor.process(recovered);
    expect(await ledger.status(batch.id)).toMatchObject({ processed: 2, sent: 2, state: "completed" });
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(2);
    expect(email.sendParticipantInviteEmail.mock.calls[1][0]).not.toEqual(sentBefore);
  });

  it("holds a PostgreSQL delivery lock across Redis replacement so old and recovered workers cannot send together", async () => {
    const p = await participant(), batch = await invites.resendSelected([p.id], actor.id);
    await eventually(async () => !!await inviteQueue.getJob(batch.id));
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    email.sendParticipantInviteEmail.mockImplementationOnce(async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); });
    const old = processor.process((await inviteQueue.getJob(batch.id))!);
    await ready;
    try {
      await redis.flushdb(); await recovery.reconcile();
      await expect(processor.process((await inviteQueue.getJob(batch.id))!)).rejects.toThrow("delivery lock");
      expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(1);
    } finally { release(); await old; }
    await processor.process((await inviteQueue.getJob(batch.id))!);
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(1);
    expect(await invites.status(batch.id)).toMatchObject({ state: "completed", sent: 1 });
  });

  it("adopts an old Redis batch checkpoint before upgrade recovery without replaying its first recipient", async () => {
    const first = await participant(), second = await participant(), id = randomUUID();
    const job = await inviteQueue.add("resend", { participantIds: [first.id, second.id], requestedBy: actor.id }, { jobId: id });
    await job.updateProgress({ total: 2, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] });
    await recovery.reconcile();
    await redis.flushdb(); await recovery.reconcile();
    await processor.process((await inviteQueue.getJob(id))!);
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(1);
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ to: second.email }));
  });

  it("recovers both an unpublished import and its pending invitation handoff without duplicating participants", async () => {
    const sourceId = randomUUID();
    const dto = { cohortId: cohort.id, csv: Papa.unparse([{ participant_id: sourceId, first_name: "Example", last_name: "Learner", lms_email: randomUUID() + "@example.test", country: "Ghana", halfway_reached: "Yes", certificate: "No", finished_all_lessons: "No" }]), sourceName: "durable.csv", sendWelcomeEmail: true };
    const preview = await imports.preview(dto, actor);
    const outage = jest.spyOn(importQueue, "add").mockRejectedValueOnce(new Error("Redis unavailable"));
    const batch = await imports.enqueue({ ...dto, previewHash: preview.previewHash }, actor);
    expect(batch.state).toBe("queued"); outage.mockRestore();
    await recovery.reconcile();
    expect((await importQueue.getJob(batch.id))?.data).toEqual({ batchId: batch.id });
    const handoff = jest.spyOn(invites, "inviteImported").mockImplementationOnce(async () => { throw new Error("Simulated process interruption"); });
    await imports.process(batch.id); handoff.mockRestore();
    // Model a process kill between the committed import and starting its handoff.
    const saved = await db.getRepository(ParticipantImportBatch).findOneByOrFail({ id: batch.id });
    await db.getRepository(ParticipantImportBatch).update(batch.id, { result: { ...saved.result, invitationState: "pending" } });
    await redis.flushdb(); await recovery.reconcile();
    expect(await importQueue.getJob(batch.id)).toBeTruthy();
    await imports.process(batch.id);
    const finished = await imports.status(batch.id, actor);
    expect(finished.result).toMatchObject({ invitationState: "queued", inviteBatches: [`import-${batch.id}-0`] });
    expect(await db.getRepository(Participant).countBy({ participantId: sourceId })).toBe(1);
    await redis.flushdb(); await recovery.reconcile();
    await processor.process((await inviteQueue.getJob(finished.result.inviteBatches[0]))!);
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(1);
    await recovery.reconcile();
    expect(await db.getRepository(Participant).countBy({ participantId: sourceId })).toBe(1);
  });

  it("preserves progress written by a legacy worker after initial adoption during a rolling upgrade", async () => {
    const first = await participant(), second = await participant(), id = randomUUID();
    const job = await inviteQueue.add("resend", { participantIds: [first.id, second.id], requestedBy: actor.id }, { jobId: id });
    await job.updateProgress({ total: 2, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] });
    await recovery.reconcile();
    expect(await ledger.status(id)).toMatchObject({ processed: 1, state: "queued" });
    // The old worker finishes while the new API is rolling out.
    await job.updateProgress({ total: 2, processed: 2, sent: 2, failed: 0, skipped: 0, failures: [] });
    await recovery.reconcile();
    expect(await ledger.status(id)).toMatchObject({ processed: 2, state: "completed" });
    await redis.flushdb(); await recovery.reconcile();
    expect(await inviteQueue.getJob(id)).toBeUndefined();
    expect(email.sendParticipantInviteEmail).not.toHaveBeenCalled();
  });

  it("retains failed-recipient results without automatically resending them after Redis loss", async () => {
    const p = await participant(), batch = await invites.resendSelected([p.id], actor.id);
    await eventually(async () => !!await inviteQueue.getJob(batch.id));
    email.sendParticipantInviteEmail.mockRejectedValueOnce(new Error("Email provider failure"));
    await processor.process((await inviteQueue.getJob(batch.id))!);
    await redis.flushdb(); await recovery.reconcile();
    expect(await inviteQueue.getJob(batch.id)).toBeUndefined();
    expect(await invites.status(batch.id)).toMatchObject({ state: "completed", failed: 1, processed: 1 });
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledTimes(1);
  });
});
