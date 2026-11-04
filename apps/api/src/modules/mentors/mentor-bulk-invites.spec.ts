import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { MentorInvitesService } from "./mentor-invites.service";
import { MentorInvitesProcessor } from "./mentor-invites.processor";
import { ResendMentorInvitesDto, ResendImportedMentorInvitesDto } from "./dto/mentor-invites.dto";

const first = "928a4553-643f-4f48-99bb-470744e99d77", second = "e0df3577-87a6-41e2-926b-e41929ee20ca";
function fixture(ids = [first]) {
  const query: any = {};
  for (const method of ["where", "andWhere", "select", "orderBy", "from", "subQuery"]) query[method] = jest.fn(() => query);
  query.getQuery = jest.fn(() => "SELECT COUNT(*) FROM assignments");
  query.getRawMany = jest.fn(async () => ids.map(id => ({ id })));
  const repository = { createQueryBuilder: jest.fn(() => query) };
  const queue = { add: jest.fn(async () => ({ id: "batch" })), getJob: jest.fn(), setGlobalConcurrency: jest.fn() };
  const email = { requireDeliveryConfiguration: jest.fn() };
  return { query, queue, email, service: new MentorInvitesService(repository as any, queue as any, email as any) };
}

describe("Mentor bulk invitation batches", () => {
  it("queues explicit imported IDs once with the requesting staff identity", async () => {
    const { service, queue } = fixture();
    expect(await service.resendSelected([first, first], "manager")).toMatchObject({ state: "queued", total: 1, sent: 0 });
    expect(queue.add).toHaveBeenCalledWith("resend", { mentorIds: [first], requestedBy: "manager" }, expect.objectContaining({ jobId: expect.any(String), attempts: 1 }));
  });
  it("rejects empty, oversized or stale selections before creating a job", async () => {
    const { service, queue } = fixture();
    await expect(service.resendSelected([], "manager")).rejects.toThrow(BadRequestException);
    await expect(service.resendSelected(Array.from({ length: 501 }, (_, i) => String(i)), "manager")).rejects.toThrow(BadRequestException);
    await expect(service.resendSelected([first, second], "manager")).rejects.toThrow("Only imported");
    expect(queue.add).not.toHaveBeenCalled();
  });
  it.each([true, false])("scopes all-imported jobs by cohort, search and capacity %s without pagination", async hasCapacity => {
    const { service, query } = fixture([first, second]);
    expect(await service.resendImported({ cohortId: first, search: "Batch", hasCapacity }, "manager")).toMatchObject({ total: 2 });
    expect(query.where).toHaveBeenCalledWith("mentor.status = :imported", { imported: "imported" });
    expect(query.andWhere).toHaveBeenCalledWith("mentor.cohortId = :cohortId", { cohortId: first });
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining("ILIKE"), { search: "%Batch%" });
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining(hasCapacity ? ") < mentor.maxTeams" : ") >= mentor.maxTeams"));
  });
  it("rejects deleted, active and inactive filters and empty matches", async () => {
    const { service, queue } = fixture([]);
    for (const filters of [{ cohortId: first }, { cohortId: first, deleted: true }, { cohortId: first, status: "active" }, { cohortId: first, status: "inactive" }]) {
      await expect(service.resendImported(filters as any, "manager")).rejects.toThrow("No imported mentors");
    }
    expect(queue.add).not.toHaveBeenCalled();
  });
  it("requires email delivery configuration and limits concurrent batches across replicas", async () => {
    const { service, queue, email } = fixture();
    await service.onModuleInit(); expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(1);
    email.requireDeliveryConfiguration.mockImplementation(() => { throw new Error("Unavailable"); });
    await expect(service.resendSelected([first], "manager")).rejects.toThrow("Unavailable");
    expect(queue.add).not.toHaveBeenCalled();
  });
  it("reports progress and failures without exposing internal diagnostics", async () => {
    const { service, queue } = fixture();
    queue.getJob.mockResolvedValueOnce({ id: "batch", data: { mentorIds: [first] }, progress: { total: 1, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] }, getState: async () => "completed" });
    expect(await service.status("batch")).toMatchObject({ state: "completed", sent: 1 });
    queue.getJob.mockResolvedValueOnce({ id: "failed", data: { mentorIds: [first] }, progress: 0, getState: async () => "failed", failedReason: "Private diagnostic" });
    expect(await service.status("failed")).toMatchObject({ state: "failed", error: expect.not.stringContaining("Private") });
    queue.getJob.mockResolvedValueOnce(null); await expect(service.status("expired")).rejects.toThrow("not found or expired");
  });
  it("validates selected UUIDs, cohort scope and boolean filters", async () => {
    expect(await validate(plainToInstance(ResendMentorInvitesDto, { mentorIds: [first] }))).toHaveLength(0);
    for (const value of [[], [first, first], ["invalid"]]) expect((await validate(plainToInstance(ResendMentorInvitesDto, { mentorIds: value }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(ResendImportedMentorInvitesDto, {}))).length).toBeGreaterThan(0);
    expect(plainToInstance(ResendImportedMentorInvitesDto, { cohortId: first, hasCapacity: "false" }, { enableImplicitConversion: true }).hasCapacity).toBe(false);
  });
});

describe("Mentor bulk invitation worker", () => {
  function setup(mentor: any = { id: first, email: "current@example.test", status: "imported" }) {
    const repository = { findOne: jest.fn(async () => mentor) };
    const sender = { resendInvite: jest.fn(async () => ({ message: "Sent" })) };
    const worker = new MentorInvitesProcessor(repository as any, sender as any);
    const job: any = { data: { mentorIds: [first], requestedBy: "manager" }, progress: 0, updateProgress: jest.fn(async () => undefined) };
    return { repository, sender, worker, job };
  }
  it("uses the existing single-invite service with the current mentor ID", async () => {
    const { worker, sender, job } = setup();
    expect(await worker.process(job)).toMatchObject({ processed: 1, sent: 1 });
    expect(sender.resendInvite).toHaveBeenCalledWith(first);
  });
  it.each([null, { id: first, status: "active" }, { id: first, status: "inactive" }])("skips mentors no longer imported or deleted before delivery", async mentor => {
    const { worker, sender, job } = setup(mentor);
    expect(await worker.process(job)).toMatchObject({ sent: 0, skipped: 1 });
    expect(sender.resendInvite).not.toHaveBeenCalled();
  });
  it("reports delivery failures with the current email and a generic error", async () => {
    const { worker, sender, job } = setup();
    sender.resendInvite.mockRejectedValueOnce(new Error("Secret provider detail"));
    expect(await worker.process(job)).toMatchObject({ failed: 1, failures: [{ mentorId: first, email: "current@example.test", message: "Email delivery failed" }] });
  });
  it("skips a mentor who activates during the send attempt", async () => {
    const { worker, sender, repository, job } = setup();
    sender.resendInvite.mockRejectedValueOnce(new Error("Only imported"));
    repository.findOne.mockResolvedValueOnce({ id: first, email: "current@example.test", status: "imported" }).mockResolvedValueOnce({ id: first, email: "current@example.test", status: "active" });
    expect(await worker.process(job)).toMatchObject({ failed: 0, skipped: 1 });
  });
  it("resumes after a worker restart without replaying checkpointed recipients", async () => {
    const { worker, sender, job } = setup();
    job.data.mentorIds = [first, second];
    job.progress = { total: 2, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] };
    expect(await worker.process(job)).toMatchObject({ total: 2, processed: 2, sent: 2 });
    expect(sender.resendInvite).toHaveBeenCalledTimes(1);
    expect(sender.resendInvite).toHaveBeenCalledWith(second);
  });
});
