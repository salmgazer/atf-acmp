import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ParticipantInvitesService } from "./participant-invites.service";
import { ParticipantInvitesProcessor } from "./participant-invites.processor";
import { ParticipantsController } from "./participants.controller";
import { ResendParticipantInvitesDto, ResendPendingParticipantInvitesDto } from "./dto/participant-invites.dto";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";

const first = "ed6b213b-8725-43ab-a3fe-a02d419e52f4";
const second = "6c5771d8-d144-47db-9d36-f0bfbfebef7e";
const cohortId = "074ae845-d4a8-4140-8f7b-6e67408fe5df";

function fixture(ids = [first]) {
  const query: any = {};
  for (const method of ["innerJoin", "where", "andWhere", "select", "orderBy"]) query[method] = jest.fn(() => query);
  query.getRawMany = jest.fn(async () => ids.map(id => ({ id })));
  const repository = { createQueryBuilder: jest.fn(() => query), findOne: jest.fn() };
  const queue = { add: jest.fn(async () => ({ id: "batch-id" })), getJob: jest.fn(), setGlobalConcurrency: jest.fn(async () => undefined) };
  const email = { requireDeliveryConfiguration: jest.fn(), sendParticipantInviteEmail: jest.fn() };
  const records = new Map<string, any>();
  const ledger = {
    find: jest.fn(async (id: string) => records.get(id)),
    record: jest.fn(async (id: string, participantIds: string[], requestedBy: string, progress?: any, state = "queued") => {
      const value = records.get(id) || { id, participantIds, requestedBy, state, progress: progress || { total: participantIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] } }; records.set(id, value); return value;
    }),
    status: jest.fn(async (id: string) => { const value = records.get(id); if (!value) throw new NotFoundException("Invitation batch not found or expired"); return { id, state: value.state, ...value.progress, ...(value.state === "failed" ? { error: "The invitation batch stopped. Check the results before retrying." } : {}) }; }),
  };
  return { query, repository, queue, email, ledger, service: new ParticipantInvitesService(repository as any, queue as any, email as any, ledger as any) };
}

describe("Participant invitation resends", () => {
  it("queues selected participants once without changing passwords or account fields", async () => {
    const { service, query, queue } = fixture();
    expect(await service.resendSelected([first, first], "manager")).toMatchObject({ total: 1, sent: 0, state: "queued" });
    expect(query.andWhere).toHaveBeenCalledWith("p.id IN (:...ids)", { ids: [first] });
    expect(queue.add).toHaveBeenCalledWith("resend", { participantIds: [first], requestedBy: "manager" }, expect.objectContaining({ attempts: 5, jobId: expect.any(String) }));
  });

  it("requires a non-empty, bounded selection and rejects ineligible or missing members atomically", async () => {
    const { service, queue } = fixture();
    await expect(service.resendSelected([], "manager")).rejects.toThrow(BadRequestException);
    await expect(service.resendSelected(Array.from({ length: 501 }, (_, i) => String(i)), "manager")).rejects.toThrow(BadRequestException);
    await expect(service.resendSelected([first, second], "manager")).rejects.toThrow("Only active participants");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("scopes all-pending sends by cohort and filters, without pagination", async () => {
    const { service, query } = fixture([first, second]);
    expect(await service.resendPending({ cohortId, group: "North", status: "imported", search: "Jane" } as any, "manager")).toMatchObject({ total: 2 });
    expect(query.where).toHaveBeenCalledWith("p.mustChangePassword = :initialPassword", { initialPassword: true });
    expect(query.andWhere).toHaveBeenCalledWith("p.onboardingComplete = :complete", { complete: false });
    expect(query.andWhere).toHaveBeenCalledWith("p.status != :inactive", { inactive: "inactive" });
    expect(query.andWhere).toHaveBeenCalledWith("p.cohortId = :cohortId", { cohortId });
    expect(query.andWhere).toHaveBeenCalledWith("p.group = :group", { group: "North" });
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining("ILIKE"), { search: "%Jane%" });
  });

  it("supports ungrouped participants and rejects conflicting group filters", async () => {
    const { service, query } = fixture();
    await service.resendPending({ cohortId, ungrouped: true }, "manager");
    expect(query.andWhere).toHaveBeenCalledWith("p.group IS NULL");
    await expect(service.resendPending({ cohortId, group: "North", ungrouped: true }, "manager")).rejects.toThrow(BadRequestException);
  });

  it("does not queue empty batches or claim success when email is unconfigured", async () => {
    const empty = fixture([]);
    await expect(empty.service.resendPending({ cohortId }, "manager")).rejects.toThrow("No pending participants");
    expect(empty.queue.add).not.toHaveBeenCalled();
    const unavailable = fixture();
    unavailable.email.requireDeliveryConfiguration.mockImplementation(() => { throw new Error("Email unavailable"); });
    await expect(unavailable.service.resendSelected([first], "manager")).rejects.toThrow("Email unavailable");
    expect(unavailable.queue.add).not.toHaveBeenCalled();
  });

  it("limits concurrent batches globally across API replicas", async () => {
    const { service, queue } = fixture();
    await service.onModuleInit();
    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(1);
  });

  it("reports progress, failures and expired batches", async () => {
    const { service, queue } = fixture();
    queue.getJob.mockResolvedValueOnce({ id: "batch", data: { participantIds: [first, second] }, progress: { total: 2, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] }, getState: async () => "active" });
    expect(await service.status("batch")).toMatchObject({ state: "queued", processed: 1, total: 2 });
    queue.getJob.mockResolvedValueOnce({ id: "failed", data: { participantIds: [first] }, progress: 0, getState: async () => "failed", failedReason: "Private database diagnostic" });
    expect(await service.status("failed")).toMatchObject({ state: "failed", processed: 0, total: 1, error: expect.not.stringContaining("Private") });
    queue.getJob.mockResolvedValueOnce(null);
    await expect(service.status("expired")).rejects.toThrow("not found or expired");
  });

  it.each(["viewer", "evaluator", "participant", "mentor", "organization"])("denies %s access to resend endpoints and batch status", async role => {
    const guard = new RolesGuard(new Reflector());
    for (const method of ["resendInvite", "resendInvites", "resendPendingInvites", "inviteResendStatus"] as const) {
      expect(() => guard.canActivate({ getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "user", role } }) }) } as any)).toThrow(ForbiddenException);
    }
  });

  it.each(["super_admin", "program_manager"])("allows %s to resend invitations and inspect progress", async role => {
    for (const method of ["resendInvite", "resendInvites", "resendPendingInvites", "inviteResendStatus"] as const) {
      const context = { getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "user", role }, method: method === "inviteResendStatus" ? "GET" : "POST", body: {}, query: {}, params: {} }) }) } as any;
      expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
      await expect(new ResourceAccessGuard(new Reflector(), {} as any).canActivate(context)).resolves.toBe(true);
    }
  });

  it("validates UUID selections and requires a cohort for all-pending sends", async () => {
    expect(await validate(plainToInstance(ResendParticipantInvitesDto, { participantIds: [first] }))).toHaveLength(0);
    for (const value of [[], ["not-an-id"], [first, first]]) expect((await validate(plainToInstance(ResendParticipantInvitesDto, { participantIds: value }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(ResendPendingParticipantInvitesDto, {}))).length).toBeGreaterThan(0);
  });
});

describe("Participant invitation worker", () => {
  const pending = { id: first, participantId: "ATF-001", email: "participant@example.test", firstName: "Jane", mustChangePassword: true, onboardingComplete: false, status: "imported", cohort: { status: "active" } };
  const setup = (participant: any = pending) => {
    const repository = { findOne: jest.fn(async () => participant) };
    const email = { sendParticipantInviteEmail: jest.fn(async () => undefined) };
    let batch: any;
    const manager = { query: jest.fn(async () => []), findOneByOrFail: jest.fn(async () => batch), update: jest.fn(async (_entity, _id, patch) => Object.assign(batch, patch)) };
    const runner = { manager, connect: jest.fn(), query: jest.fn(async () => [{ locked: true }]), release: jest.fn(), isReleased: false };
    const ledger = { db: { createQueryRunner: () => runner }, record: jest.fn(async (id, participantIds, requestedBy, progress) => batch ||= { id, participantIds, requestedBy, progress, state: "queued" }), checkpoint: jest.fn(async (_manager, _id, progress) => { batch.progress = progress; batch.state = progress.processed === progress.total ? "completed" : "active"; }) };
    const worker = new ParticipantInvitesProcessor(repository as any, email as any, new ConfigService({ FRONTEND_URL: "https://portal.example.test/" }), ledger as any);
    const job: any = { id: "batch", data: { participantIds: [first], requestedBy: "manager" }, progress: 0, updateProgress: jest.fn(async () => undefined) };
    return { repository, email, worker, job, ledger };
  };

  it("sends the branded invitation and records the result without mutating credentials", async () => {
    const { worker, email, job, ledger } = setup();
    expect(await worker.process(job)).toMatchObject({ processed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(email.sendParticipantInviteEmail).toHaveBeenCalledWith({ to: pending.email, firstName: "Jane", participantId: "ATF-001", portalUrl: "https://portal.example.test/participant/login" });
    expect(ledger.checkpoint).toHaveBeenCalledWith(expect.anything(), "batch", expect.objectContaining({ sent: 1 }));
  });

  it.each([null, { ...pending, mustChangePassword: false }, { ...pending, onboardingComplete: true }, { ...pending, status: "inactive" }, { ...pending, cohort: { status: "draft" } }, { ...pending, cohort: { status: "archived" } }])("rechecks eligibility before delivery", async participant => {
    const { worker, email, job } = setup(participant);
    expect(await worker.process(job)).toMatchObject({ sent: 0, skipped: 1 });
    expect(email.sendParticipantInviteEmail).not.toHaveBeenCalled();
  });

  it("reports a delivery failure and stores a checkpoint", async () => {
    const { worker, email, job, ledger } = setup();
    email.sendParticipantInviteEmail.mockRejectedValue(new Error("Private provider diagnostic") as never);
    expect(await worker.process(job)).toMatchObject({ sent: 0, failed: 1, failures: [{ participantId: "ATF-001", message: "Email delivery failed" }] });
    expect(ledger.checkpoint).toHaveBeenCalledWith(expect.anything(), "batch", expect.objectContaining({ processed: 1, failed: 1 }));
  });

  it("resumes from the last checkpoint after a worker restart", async () => {
    const { worker, repository, job } = setup();
    job.data.participantIds = [first, second];
    job.progress = { total: 2, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] };
    expect(await worker.process(job)).toMatchObject({ total: 2, processed: 2, sent: 2 });
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: second }, relations: ["cohort"] });
  });
});
