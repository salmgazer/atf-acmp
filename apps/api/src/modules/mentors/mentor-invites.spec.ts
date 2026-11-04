import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { MentorsController } from "./mentors.controller";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";
import { UpdateMentorDto } from "./dto/mentor.dto";

describe("Mentor invitation staff boundaries", () => {
  it.each(["viewer", "evaluator", "mentor", "organization", "participant"])("denies %s access to invitation resends", role => {
    for (const method of ["resendInvite", "resendInvites", "resendImportedInvites", "inviteResendStatus"] as const) {
      const context = { getClass: () => MentorsController, getHandler: () => MentorsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role } }) }) } as any;
      expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(ForbiddenException);
    }
  });
  it.each(["super_admin", "program_manager"])("allows %s to resend mentor invitations", async role => {
    for (const method of ["resendInvite", "resendInvites", "resendImportedInvites", "inviteResendStatus"] as const) {
      const context = { getClass: () => MentorsController, getHandler: () => MentorsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role }, method: method === "inviteResendStatus" ? "GET" : "POST", body: {}, query: {}, params: { id: "mentor" } }) }) } as any;
      expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
      await expect(new ResourceAccessGuard(new Reflector(), {} as any).canActivate(context)).resolves.toBe(true);
    }
  });
  it("normalizes and validates corrected email addresses", async () => {
    const update = plainToInstance(UpdateMentorDto, { email: " Corrected@Example.test " });
    expect(update.email).toBe("corrected@example.test");
    expect(await validate(update)).toHaveLength(0);
    expect((await validate(plainToInstance(UpdateMentorDto, { email: "invalid" }))).length).toBeGreaterThan(0);
  });
});
