import "reflect-metadata";
import { CallHandler, ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AddressInfo } from "net";
import { configureBodyParsers } from "@/common/configure-body-parsers";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { UploadService } from "@/common/services/upload.service";
import { OrganizationsController } from "@/modules/organizations/organizations.controller";
import { OrganizationsService } from "@/modules/organizations/organizations.service";
import { PartnerInvitesService } from "@/modules/organizations/partner-invites.service";
import { SubmissionImportService } from "@/modules/organizations/submission-import.service";
import { ParticipantsController } from "@/modules/participants/participants.controller";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { ParticipantInvitesService } from "@/modules/participants/participant-invites.service";
import { ParticipantImportService } from "@/modules/participants/participant-import.service";

describe("Organization HTTP request body parsing", () => {
  let app: INestApplication;
  let base: string;
  const partnerId = "928a4553-643f-4f48-99bb-470744e99d77";
  const actorId = "e0df3577-87a6-41e2-926b-e41929ee20ca";
  const organizations = { bulkApprove: jest.fn(async (ids: string[]) => ({ approvedCount: ids.length, organizationIds: ids })) };
  const invites = { resendSelected: jest.fn(async () => ({ id: "test-batch" })) };
  const submissions = {
    preview: jest.fn(async () => ({ valid: true })),
    apply: jest.fn(async () => ({ created: 1 })),
  };
  const participantImports = { preview: jest.fn(async () => ({ ready: true })), enqueue: jest.fn(async () => ({ id: "batch" })) };
  beforeAll(async () => {
    const auth = { canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { id: actorId, role: "program_manager" };
      return true;
    } };
    const module = await Test.createTestingModule({
      controllers: [OrganizationsController, ParticipantsController],
      providers: [
        { provide: OrganizationsService, useValue: organizations },
        { provide: UploadService, useValue: {} },
        { provide: PartnerInvitesService, useValue: invites },
        { provide: SubmissionImportService, useValue: submissions },
        { provide: ParticipantsService, useValue: {} },
        { provide: ParticipantInvitesService, useValue: {} },
        { provide: ParticipantImportService, useValue: participantImports },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(auth)
      .overrideInterceptor(AuditInterceptor).useValue({ intercept(_context: ExecutionContext, next: CallHandler) { return next.handle(); } })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureBodyParsers(app);
    app.setGlobalPrefix("api");
    app.useGlobalGuards(auth, new RolesGuard(new Reflector()), new ResourceAccessGuard(new Reflector(), {} as any));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/organizations`;
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => { if (app) await app.close(); });
  const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const importBody = () => ({ cohortId: partnerId, sourceName: "large.csv", sourceTimezone: "Africa/Accra", csv: "a".repeat(150000) });

  it("passes selected UUIDs and authenticated staff identity through the real bulk approval HTTP route", async () => {
    const response = await post("/bulk-approve", { organizationIds: [partnerId] });
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 200, body: { approvedCount: 1, organizationIds: [partnerId] } });
    expect(organizations.bulkApprove).toHaveBeenCalledWith([partnerId], actorId);
  });

  it("still rejects invalid approval selections before calling the service", async () => {
    const response = await post("/bulk-approve", { organizationIds: [] });
    expect(response.status).toBe(400);
    expect((await response.json() as { message: string[] }).message).toContain("organizationIds must contain at least 1 elements");
    expect(organizations.bulkApprove).not.toHaveBeenCalled();
  });

  it("parses normal JSON for invitation requests outside the importer", async () => {
    const response = await post("/resend-invites", { organizationIds: [partnerId] });
    expect(response.status).toBe(202);
    expect(invites.resendSelected).toHaveBeenCalledWith([partnerId], actorId);
  });

  it.each(["preview", "apply"] as const)("accepts CSV payloads above the normal limit on import %s", async action => {
    const body = { ...importBody(), ...(action === "apply" ? { previewHash: "a".repeat(64) } : {}) };
    const response = await post(`/submission-import/${action}`, body);
    expect(response.status).toBe(200);
    expect(submissions[action]).toHaveBeenCalledWith(body, expect.objectContaining({ id: actorId }));
  });

  it("retains selected update fields through HTTP validation and rejects unsupported, duplicated and non-array selections", async () => {
    const body = { ...importBody(), mode: "update_existing", updateFields: ["industry"] };
    expect((await post("/submission-import/preview", body)).status).toBe(200);
    expect(submissions.preview).toHaveBeenCalledWith(body, expect.objectContaining({ id: actorId }));
    submissions.preview.mockClear();
    for (const updateFields of [["status"], ["industry", "industry"], [], "industry"]) expect((await post("/submission-import/preview", { ...body, updateFields })).status).toBe(400);
    expect(submissions.preview).not.toHaveBeenCalled();
  });

  it("keeps the normal JSON limit on other routes", async () => {
    const response = await post("/bulk-approve", { organizationIds: [partnerId], oversized: "a".repeat(150000) });
    expect(response.status).toBe(413);
    expect(organizations.bulkApprove).not.toHaveBeenCalled();
  });

  it("accepts a full-size participant feed only on the authenticated import route", async () => {
    const input = { cohortId: partnerId, sourceName: "participants.csv", csv: "a".repeat(750000), sendWelcomeEmail: false };
    const response = await fetch(`${base.replace(/\/organizations$/, "/participants")}/import/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    expect(response.status).toBe(200);
    expect(participantImports.preview).toHaveBeenCalledWith(expect.objectContaining(input), expect.objectContaining({ id: actorId }));
  });

  it("rejects malformed JSON before calling the approval service", async () => {
    const response = await fetch(`${base}/bulk-approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"organizationIds":' });
    expect(response.status).toBe(400);
    expect(organizations.bulkApprove).not.toHaveBeenCalled();
  });
});
