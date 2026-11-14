import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { Reflector } from "@nestjs/core";
import { ForbiddenException } from "@nestjs/common";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";
import { ParticipantsController } from "./participants.controller";
import { TeamsController } from "../teams/teams.controller";
import { CompleteOnboardingDto, UpdateParticipantProgrammeDto } from "./dto/participant.dto";

const input = () => ({ profile: { firstName: "Example", lastName: "Learner", country: "Ghana", githubAccountStatus: "no_account" }, skills: { skills: [], interests: [] }, preferences: { briefRankings: [], crossCountryWilling: false, buildDeployAbility: "no", preferredRole: "business_impact_lead", firstChoiceSector: "education", backupSector: "health", teamStatus: "need_team", matchingProfileConsent: false } });
const errorsFor = (value: unknown) => validate(plainToInstance(CompleteOnboardingDto, value, { enableImplicitConversion: true }), { whitelist: true, forbidNonWhitelisted: true });
const messages = (errors: ValidationError[]): string => JSON.stringify(errors.map(error => ({ property: error.property, constraints: error.constraints, children: error.children?.map(child => ({ property: child.property, constraints: child.constraints, children: child.children })) })));

describe("Participant onboarding validation and privacy boundaries", () => {
  it("accepts explicit No answers and does not require certificates, technical skill tags or a GitHub account", async () => {
    expect(await errorsFor(input())).toHaveLength(0);
    const dto = plainToInstance(CompleteOnboardingDto, { ...input(), preferences: { ...input().preferences, crossCountryWilling: "false", matchingProfileConsent: "false" } }, { enableImplicitConversion: true });
    expect(dto.preferences.crossCountryWilling).toBe(false); expect(dto.preferences.matchingProfileConsent).toBe(false);
  });
  it.each(["buildDeployAbility", "preferredRole", "firstChoiceSector", "backupSector", "teamStatus", "crossCountryWilling", "matchingProfileConsent"])("requires the explicit %s answer", async field => {
    const dto: any = input(); delete dto.preferences[field]; expect(messages(await errorsFor(dto))).toContain(field);
  });
  it("rejects absent nested answers, unsupported roles/sectors and attempts to change authoritative learning or credentials", async () => {
    expect(await errorsFor({})).not.toHaveLength(0);
    const dto: any = input(); dto.preferences.preferredRole = "leader"; dto.preferences.firstChoiceSector = "arbitrary"; dto.profile.passwordHash = "injected"; dto.profile.learningCertificateIssued = true;
    const errors = messages(await errorsFor(dto));
    for (const field of ["preferredRole", "firstChoiceSector", "passwordHash", "learningCertificateIssued"]) expect(errors).toContain(field);
  });
  it("requires a username for an existing GitHub account, rejects URLs, and accepts valid normalized usernames", async () => {
    const dto: any = input(); dto.profile.githubAccountStatus = "has_account";
    expect(messages(await errorsFor(dto))).toContain("githubUsername");
    for (const username of ["https://github.com/example", "@example", "two--hyphens", "not a username"]) { dto.profile.githubUsername = username; expect(messages(await errorsFor(dto))).toContain("githubUsername"); }
    dto.profile.githubUsername = "example-user"; expect(await errorsFor(dto)).toHaveLength(0);
  });
  it.each(["program_manager", "super_admin", "viewer", "evaluator", "mentor", "organization"])("does not allow %s to choose another participant's matching consent", role => {
    for (const method of ["updateMatchingConsent", "updateCrossCountryPreference", "updateMatchingProfile", "completeOnboarding"] as const) {
      const context = { getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "staff", role } }) }) } as any;
      expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(ForbiddenException);
    }
  });
  it("does not allow a participant to change someone else's matching consent", async () => {
    const req = { method: "PATCH", user: { id: "self", role: "participant" }, params: { id: "other" }, body: { consent: true }, query: {} };
    const context = { getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype.updateMatchingConsent, switchToHttp: () => ({ getRequest: () => req }) } as any;
    await expect(new ResourceAccessGuard(new Reflector(), {} as any).canActivate(context)).rejects.toThrow(ForbiddenException);
  });
  it("allows only the participant to change their own cross-country preference", async () => {
    for (const id of ["self", "other"]) {
      const req = { method: "PATCH", user: { id: "self", role: "participant" }, params: { id }, body: { crossCountryWilling: false }, query: {} };
      const context = { getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype.updateCrossCountryPreference, switchToHttp: () => ({ getRequest: () => req }) } as any;
      const authorize = new ResourceAccessGuard(new Reflector(), {} as any).canActivate(context);
      if (id === "self") await expect(authorize).resolves.toBe(true);
      else await expect(authorize).rejects.toThrow(ForbiddenException);
    }
  });
  it("requires participant-search consent in the public-facing controller while preserving staff search", async () => {
    const service = { searchAvailableParticipants: jest.fn() };
    const controller = new TeamsController(service as any);
    const query = { cohortId: "cohort", query: "example", limit: 10 };
    await controller.searchParticipants(query, { role: "participant" });
    expect(service.searchAvailableParticipants).toHaveBeenLastCalledWith("cohort", "example", 10, undefined, true);
    await controller.searchParticipants(query, { role: "program_manager" });
    expect(service.searchAvailableParticipants).toHaveBeenLastCalledWith("cohort", "example", 10, undefined, false);
  });
  it.each(["participant", "viewer", "evaluator", "mentor", "organization"])("does not allow %s to edit programme opt-outs or CodeLabs verification", role => {
    const context = { getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype.updateProgrammeStatus, switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role } }) }) } as any;
    expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(ForbiddenException);
  });
  it("accepts explicit No programme flags and prevents callers from forging verification attribution", async () => {
    const dto = plainToInstance(UpdateParticipantProgrammeDto, { programmeOptedOut: "false", codeLabsCompleted: "false" }, { enableImplicitConversion: true });
    expect(dto).toMatchObject({ programmeOptedOut: false, codeLabsCompleted: false }); expect(await validate(dto)).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateParticipantProgrammeDto, { codeLabsCompleted: true, codeLabsVerifiedBy: "forged" }), { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
  });
  it.each(["registerTeam", "startChallenge"])("restricts %s to team leads/co-leads or staff managers", async method => {
    const req = { method: "POST", user: { id: "member", role: "participant" }, params: { id: "team" }, body: {}, query: {} };
    const context = { getClass: () => TeamsController, getHandler: () => (TeamsController.prototype as any)[method], switchToHttp: () => ({ getRequest: () => req }) } as any;
    const db = { getRepository: () => ({ findOne: async () => ({ participantId: "member", teamId: "team", role: "member" }) }) };
    await expect(new ResourceAccessGuard(new Reflector(), db as any).canActivate(context)).rejects.toThrow(ForbiddenException);
  });

});
