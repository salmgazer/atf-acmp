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
import { BriefsController } from "@/modules/briefs/briefs.controller";
import { BriefsService } from "@/modules/briefs/briefs.service";
import { VerticalsService } from "@/modules/verticals/verticals.service";

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
  const participantProfiles = { updateStaffProfile: jest.fn(async (id: string, dto: any) => ({ id, city: dto.city })) };
  const briefs = { findAll: jest.fn(async () => ({ data: [], total: 0 })), getStatistics: jest.fn(async () => ({ total: 0 })) };
  beforeAll(async () => {
    const auth = { canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest();
      request.user = { id: actorId, role: request.headers["x-test-role"] || "program_manager", cohortId: partnerId };
      return true;
    } };
    const module = await Test.createTestingModule({
      controllers: [OrganizationsController, ParticipantsController, BriefsController],
      providers: [
        { provide: OrganizationsService, useValue: organizations },
        { provide: UploadService, useValue: {} },
        { provide: PartnerInvitesService, useValue: invites },
        { provide: SubmissionImportService, useValue: submissions },
        { provide: ParticipantsService, useValue: participantProfiles },
        { provide: ParticipantInvitesService, useValue: {} },
        { provide: ParticipantImportService, useValue: participantImports },
        { provide: BriefsService, useValue: briefs },
        { provide: VerticalsService, useValue: {} },
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

  it("retains country and pending-review query fields through real HTTP validation", async () => {
    const url = base.replace(/\/organizations$/, "/briefs");
    expect((await fetch(`${url}?country=Ghana&pendingReview=true&cohortId=${partnerId}&page=2&limit=100`)).status).toBe(200);
    expect(briefs.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ country: "Ghana", pendingReview: true, cohortId: partnerId, page: 2, limit: 100 }));
    expect((await fetch(`${url}?country=Kenya&pendingReview=false`)).status).toBe(200);
    expect(briefs.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ country: "Kenya", pendingReview: false }));
    briefs.findAll.mockClear();
    expect((await fetch(`${url}?pendingReview=invalid`)).status).toBe(400);
    expect(briefs.findAll).not.toHaveBeenCalled();
    expect((await fetch(`${url}/statistics?cohortId=${partnerId}&country=Kenya`)).status).toBe(200);
    expect(briefs.getStatistics).toHaveBeenCalledWith(partnerId, "Kenya");
  });

  it("preserves participant cohort and approved-only boundaries when filtering pending briefs", async () => {
    const url = base.replace(/\/organizations$/, "/briefs");
    const response = await fetch(`${url}?country=Kenya&pendingReview=true&status=submitted&cohortId=${actorId}`, { headers: { "x-test-role": "participant" } });
    expect(response.status).toBe(200);
    expect(briefs.findAll).toHaveBeenCalledWith(expect.objectContaining({ country: "Kenya", pendingReview: true, cohortId: partnerId, status: "approved" }), actorId);
    expect((await fetch(`${url}/statistics?country=Kenya`, { headers: { "x-test-role": "participant" } })).status).toBe(200);
    expect(briefs.getStatistics).toHaveBeenCalledWith(partnerId, "Kenya", actorId);
  });

  const patchProfile = (body: unknown, role = "program_manager") => fetch(base.replace(/\/organizations$/, `/participants/${actorId}/profile`), { method: "PATCH", headers: { "Content-Type": "application/json", "x-test-role": role }, body: JSON.stringify(body) });
  const profileBody = () => ({ expectedUpdatedAt: "2026-11-12T20:00:00.000Z", city: " Newtown ", learningCertificateIssued: false });
  it.each(["program_manager", "super_admin"])("allows %s to save the staff profile using its authenticated identity", async role => {
    expect((await patchProfile(profileBody(), role)).status).toBe(200);
    expect(participantProfiles.updateStaffProfile).toHaveBeenCalledWith(actorId, expect.objectContaining({ city: "Newtown", learningCertificateIssued: false }), expect.objectContaining({ id: actorId, role }));
  });
  it.each(["participant", "mentor", "organization", "viewer", "evaluator"])("rejects staff profile edits from %s", async role => {
    expect((await patchProfile(profileBody(), role)).status).toBe(403);
    expect(participantProfiles.updateStaffProfile).not.toHaveBeenCalled();
  });
  it.each(["email", "passwordHash", "participantId", "cohortId", "group", "status", "mustChangePassword", "matchingProfileConsent", "learningImportedAt", "actorId"])("rejects attempts to edit protected field %s", async field => {
    expect((await patchProfile({ ...profileBody(), [field]: actorId })).status).toBe(400);
    expect(participantProfiles.updateStaffProfile).not.toHaveBeenCalled();
  });
  it("validates profile values and preserves explicit false correction flags", async () => {
    for (const patch of [{ firstName: " " }, { lastName: null }, { skills: null }, { lmsEmail: "not-an-email" }, { githubUsername: "https://github.com/example" }, { city: "a".repeat(151) }, { learningHalfwayReached: "maybe" }, { expectedUpdatedAt: "invalid" }]) {
      expect((await patchProfile({ ...profileBody(), ...patch })).status).toBe(400);
    }
    expect(participantProfiles.updateStaffProfile).not.toHaveBeenCalled();
    expect((await patchProfile({ ...profileBody(), learningCertificateIssued: "false", allowLearningCorrections: "false" })).status).toBe(200);
    expect(participantProfiles.updateStaffProfile).toHaveBeenCalledWith(actorId, expect.objectContaining({ learningCertificateIssued: false, allowLearningCorrections: false }), expect.anything());
  });
});
