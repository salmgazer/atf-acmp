import "reflect-metadata";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationsController } from "./organizations.controller";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PartnerInvitesService } from "./partner-invites.service";
import { PartnerInvitesProcessor } from "./partner-invites.processor";
import { ResendPartnerInvitesDto, ResendEligiblePartnerInvitesDto } from "./dto/partner-invites.dto";
import { BulkApproveOrganizationsDto } from "./dto/organization.dto";

const first = "928a4553-643f-4f48-99bb-470744e99d77", second = "e0df3577-87a6-41e2-926b-e41929ee20ca";
function fixture(ids = [first]) {
  const query: any = {};
  for (const method of ["where", "andWhere", "select", "orderBy", "from"]) query[method] = jest.fn(() => query);
  query.getRawMany = jest.fn(async () => ids.map(id => ({ id })));
  const repository = { createQueryBuilder: jest.fn(() => query) };
  const queue = { add: jest.fn(async () => ({ id: "batch" })), getJob: jest.fn(), setGlobalConcurrency: jest.fn() };
  const email = { requireDeliveryConfiguration: jest.fn() };
  return { query, queue, email, service: new PartnerInvitesService(repository as any, queue as any, email as any) };
}

describe("Partner bulk invitation batches", () => {
  it("queues explicit approved IDs once with the requesting staff identity", async () => {
    const { service, queue } = fixture();
    expect(await service.resendSelected([first, first], "manager")).toMatchObject({ state: "queued", total: 1, sent: 0 });
    expect(queue.add).toHaveBeenCalledWith("resend", { organizationIds: [first], requestedBy: "manager" }, expect.objectContaining({ jobId: expect.any(String), attempts: 1 }));
  });
  it("rejects empty, oversized or stale selections before creating a job", async () => {
    const { service, queue } = fixture();
    await expect(service.resendSelected([], "manager")).rejects.toThrow(BadRequestException);
    await expect(service.resendSelected(Array.from({ length: 501 }, (_, i) => String(i)), "manager")).rejects.toThrow(BadRequestException);
    await expect(service.resendSelected([first, second], "manager")).rejects.toThrow("Only approved");
    expect(queue.add).not.toHaveBeenCalled();
  });
  it("scopes all-approved jobs by active status, cohort, search and country without pagination", async () => {
    const { service, query } = fixture([first, second]);
    expect(await service.resendEligible({ cohortId: first, search: "Batch", country: "GH" }, "manager")).toMatchObject({ total: 2 });
    expect(query.where).toHaveBeenCalledWith("organization.status = :approved", { approved: "approved" });
    expect(query.andWhere).toHaveBeenCalledWith("organization.isActive = true");
    expect(query.andWhere).toHaveBeenCalledWith("organization.cohortId = :cohortId", { cohortId: first });
    expect(query.andWhere).toHaveBeenCalledWith("organization.name ILIKE :search", { search: "%Batch%" });
    expect(query.andWhere).toHaveBeenCalledWith("organization.country = :country", { country: "GH" });
  });
  it("rejects pending and rejected filters and empty matches", async () => {
    const { service, queue } = fixture([]);
    for (const filters of [{ cohortId: first }, { cohortId: first, status: "pending" }, { cohortId: first, status: "rejected" }]) {
      await expect(service.resendEligible(filters as any, "manager")).rejects.toThrow("No approved, active partners");
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
    queue.getJob.mockResolvedValueOnce({ id: "batch", data: { organizationIds: [first] }, progress: { total: 1, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] }, getState: async () => "completed" });
    expect(await service.status("batch")).toMatchObject({ state: "completed", sent: 1 });
    queue.getJob.mockResolvedValueOnce({ id: "failed", data: { organizationIds: [first] }, progress: 0, getState: async () => "failed", failedReason: "Private diagnostic" });
    expect(await service.status("failed")).toMatchObject({ state: "failed", error: expect.not.stringContaining("Private") });
    queue.getJob.mockResolvedValueOnce(null); await expect(service.status("expired")).rejects.toThrow("not found or expired");
  });
  it("validates unique selected UUIDs and required cohort scope", async () => {
    expect(await validate(plainToInstance(ResendPartnerInvitesDto, { organizationIds: [first] }))).toHaveLength(0);
    for (const value of [[], [first, first], ["invalid"]]) expect((await validate(plainToInstance(ResendPartnerInvitesDto, { organizationIds: value }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(ResendEligiblePartnerInvitesDto, {}))).length).toBeGreaterThan(0);
  });
});

describe("Partner bulk invitation worker", () => {
  function setup(organization: any = { id: first, email: "current@example.test", status: "approved", isActive: true }) {
    const repository = { findOne: jest.fn(async () => organization) };
    const sender = { sendInvite: jest.fn(async () => ({ success: true })) };
    const worker = new PartnerInvitesProcessor(repository as any, sender as any);
    const job: any = { data: { organizationIds: [first], requestedBy: "manager" }, progress: 0, updateProgress: jest.fn(async () => undefined) };
    return { repository, sender, worker, job };
  }
  it("uses the existing single-invite service with the current organization ID", async () => {
    const { worker, sender, job } = setup();
    expect(await worker.process(job)).toMatchObject({ processed: 1, sent: 1 });
    expect(sender.sendInvite).toHaveBeenCalledWith(first);
  });
  it.each([null, { id: first, status: "pending", isActive: true }, { id: first, status: "rejected", isActive: true }, { id: first, status: "approved", isActive: false }])("skips partners no longer approved and active or deleted before delivery", async organization => {
    const { worker, sender, job } = setup(organization);
    expect(await worker.process(job)).toMatchObject({ sent: 0, skipped: 1 });
    expect(sender.sendInvite).not.toHaveBeenCalled();
  });
  it("reports delivery failures with the current email and a generic error", async () => {
    const { worker, sender, job } = setup();
    sender.sendInvite.mockRejectedValueOnce(new Error("Secret provider detail"));
    expect(await worker.process(job)).toMatchObject({ failed: 1, failures: [{ organizationId: first, email: "current@example.test", message: "Email delivery failed" }] });
  });
  it("does not count a false delivery result as sent", async () => {
    const { worker, sender, job } = setup();
    sender.sendInvite.mockResolvedValueOnce({ success: false });
    expect(await worker.process(job)).toMatchObject({ sent: 0, failed: 1 });
  });
  it("skips a partner who is deactivated during the send attempt", async () => {
    const { worker, sender, repository, job } = setup();
    sender.sendInvite.mockRejectedValueOnce(new Error("Only approved"));
    repository.findOne.mockResolvedValueOnce({ id: first, email: "current@example.test", status: "approved", isActive: true }).mockResolvedValueOnce({ id: first, email: "current@example.test", status: "approved", isActive: false });
    expect(await worker.process(job)).toMatchObject({ failed: 0, skipped: 1 });
  });
  it("resumes after a worker restart without replaying checkpointed recipients", async () => {
    const { worker, sender, job } = setup();
    job.data.organizationIds = [first, second];
    job.progress = { total: 2, processed: 1, sent: 1, failed: 0, skipped: 0, failures: [] };
    expect(await worker.process(job)).toMatchObject({ total: 2, processed: 2, sent: 2 });
    expect(sender.sendInvite).toHaveBeenCalledTimes(1);
    expect(sender.sendInvite).toHaveBeenCalledWith(second);
  });
});

describe("Partner invitation staff boundaries", () => {
  it.each(["viewer", "evaluator", "mentor", "organization", "participant"])("denies %s access to invitation resends", role => {
    for (const method of ["bulkApprove", "sendInvite", "resendInvites", "bulkSendInvites", "resendEligibleInvites", "inviteResendStatus"] as const) {
      const context = { getClass: () => OrganizationsController, getHandler: () => OrganizationsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role } }) }) } as any;
      expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(ForbiddenException);
    }
  });
  it.each(["super_admin", "program_manager"])("allows %s to resend partner invitations", async role => {
    for (const method of ["bulkApprove", "sendInvite", "resendInvites", "bulkSendInvites", "resendEligibleInvites", "inviteResendStatus"] as const) {
      const context = { getClass: () => OrganizationsController, getHandler: () => OrganizationsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role }, method: method === "inviteResendStatus" ? "GET" : "POST", body: {}, query: {}, params: { id: "partner" } }) }) } as any;
      expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
      await expect(new ResourceAccessGuard(new Reflector(), {} as any).canActivate(context)).resolves.toBe(true);
    }
  });
});

describe("Partner bulk approval requests", () => {
  it.each([[], [first, first], ["invalid-id"], Array.from({ length: 501 }, () => first)].map(ids => [ids]))("rejects empty, duplicate, malformed or oversized selections", async ids => {
    expect((await validate(plainToInstance(BulkApproveOrganizationsDto, { organizationIds: ids }))).length).toBeGreaterThan(0);
  });
  it("validates a selected partner list and passes the authenticated staff identity", async () => {
    expect(await validate(plainToInstance(BulkApproveOrganizationsDto, { organizationIds: [first, second] }))).toHaveLength(0);
    const service = { bulkApprove: jest.fn(async () => ({ approvedCount: 2 })) };
    const controller = new OrganizationsController(service as any, {} as any, {} as any, {} as any);
    await controller.bulkApprove({ organizationIds: [first, second] }, "authenticated-manager");
    expect(service.bulkApprove).toHaveBeenCalledWith([first, second], "authenticated-manager");
  });
});
