import "reflect-metadata";
import { BadRequestException, CallHandler, ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AddressInfo } from "net";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { TeamsController } from "@/modules/teams/teams.controller";
import { TeamsService } from "@/modules/teams/teams.service";

describe("Participant team creation authorization over HTTP", () => {
  let app: INestApplication, base: string;
  const participantId = "836b9b32-1df7-44ea-87f7-d9039ee59728";
  const otherId = "b590a2cf-af51-4857-9b57-34f72411c5c2";
  const cohortId = "4753d422-d547-4071-9e31-c85324f06031";
  const teamId = "52f1db29-267c-4125-8dab-d7155293370f";
  const service = { create: jest.fn(async dto => ({ id: teamId, ...dto })) };
  const database = { getRepository: jest.fn(() => ({ findOne: jest.fn(async () => null) })) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamsController], providers: [{ provide: TeamsService, useValue: service }],
    }).overrideInterceptor(AuditInterceptor).useValue({
      intercept(_context: ExecutionContext, next: CallHandler) { return next.handle(); },
    }).compile();
    app = module.createNestApplication({ logger: false });
    // This fixture replaces authentication only; authorization uses the real
    // controller metadata and guards, not a hand-written route string.
    app.useGlobalGuards({ canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      const role = req.headers["x-test-role"] || "participant";
      if (role !== "anonymous") req.user = { id: participantId, role, cohortId };
      return true;
    } }, new RolesGuard(new Reflector()), new ResourceAccessGuard(new Reflector(), database as any));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/teams`;
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => { if (app) await app.close(); });
  const input = () => ({ name: "Example team", description: "A participant-created team", cohortId, creatorId: participantId });
  const post = (body: unknown, role = "participant", path = "") => fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json", "x-test-role": role }, body: JSON.stringify(body),
  });

  it("allows a teamless participant to reach creation using Nest's actual root route metadata", async () => {
    expect(Reflect.getMetadata(PATH_METADATA, TeamsController.prototype.create)).toBe("/");
    const response = await post(input());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: teamId, creatorId: participantId, cohortId });
    expect(service.create).toHaveBeenCalledWith(input());
    expect(database.getRepository).not.toHaveBeenCalled();
  });

  it("derives the creator from authentication, ignoring a forged creator ID", async () => {
    expect((await post({ ...input(), creatorId: otherId })).status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ creatorId: participantId }));
  });

  it("does not require participants to supply their own identity", async () => {
    const { creatorId: _creatorId, ...body } = input();
    expect((await post(body)).status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ creatorId: participantId }));
  });

  it.each([otherId, undefined])("rejects a foreign or missing cohort (%s)", async submittedCohort => {
    expect((await post({ ...input(), cohortId: submittedCohort })).status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
    expect(database.getRepository).not.toHaveBeenCalled();
  });

  it.each(["anonymous", "mentor", "organization", "viewer", "evaluator"])("does not grant team creation to %s", async role => {
    expect((await post(input(), role)).status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it.each(["program_manager", "super_admin"])("preserves %s creation on behalf of a chosen participant", async role => {
    const body = { ...input(), creatorId: otherId };
    expect((await post(body, role)).status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it("still validates team data before calling the service", async () => {
    expect((await post({ ...input(), name: "A" })).status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("preserves service eligibility failures instead of bypassing team rules", async () => {
    service.create.mockRejectedValueOnce(new BadRequestException("The team joining and registration deadline has passed"));
    const response = await post(input());
    expect(response.status).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("deadline has passed");
  });

  it("does not confuse another team's action with the collection creation route", async () => {
    expect((await post({}, "participant", `/${teamId}/register`)).status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
  });
});
