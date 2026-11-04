import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { BriefEventsController } from "./brief-events.controller";
import { BriefEventsService } from "./brief-events.service";
import { BriefEventCalendarQueryDto } from "./dto/brief-event-calendar.dto";

const query = { cohortId: "318cb096-48d3-4d3b-8db6-4ef6e6c21356", startAt: "2030-06-01T00:00:00Z", endAt: "2030-07-01T00:00:00Z" };
const roles = new RolesGuard(new Reflector());
const context = (role: string) => ({ getClass: () => BriefEventsController, getHandler: () => BriefEventsController.prototype.staffCalendar, switchToHttp: () => ({ getRequest: () => ({ user: { id: "staff", role } }) }) } as any);

describe("Staff partner event calendar", () => {
  it.each(["super_admin", "program_manager", "evaluator", "viewer"])("allows %s to read events across cohorts", async role => {
    expect(roles.canActivate(context(role))).toBe(true);
    const builder: any = {};
    for (const method of ["innerJoinAndSelect", "select", "where", "andWhere", "orderBy", "addOrderBy"]) builder[method] = jest.fn(() => builder);
    builder.getMany = jest.fn(async () => []);
    const service = new BriefEventsService({ getRepository: () => ({ createQueryBuilder: () => builder }) } as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    expect(await service.staffCalendar(query, { id: "staff", role, cohortId: "different-cohort" })).toEqual({ events: [] });
    expect(builder.where).toHaveBeenCalledWith("brief.cohortId = :cohortId", { cohortId: query.cohortId });
  });
  it.each(["organization", "participant", "mentor"])("denies %s access to the staff calendar at the controller and service", async role => {
    expect(() => roles.canActivate(context(role))).toThrow(ForbiddenException);
    const service = new BriefEventsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.staffCalendar(query, { id: "external", role })).rejects.toThrow(ForbiddenException);
  });
  it.each([
    { startAt: "invalid" }, { startAt: "2030-06-01T00:00:00" },
    { endAt: "2030-06-01T00:00:00Z" }, { endAt: "2030-05-01T00:00:00Z" }, { endAt: "2031-07-01T00:00:00Z" },
  ])("rejects invalid, ambiguous, reversed and excessive date ranges before querying", async dates => {
    const service = new BriefEventsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.staffCalendar({ ...query, ...dates }, { id: "staff", role: "viewer" })).rejects.toThrow("calendar range");
  });
  it("requires a cohort UUID and valid ISO date strings", async () => {
    expect(await validate(plainToInstance(BriefEventCalendarQueryDto, query))).toHaveLength(0);
    for (const input of [{}, { ...query, cohortId: "bad" }, { ...query, startAt: "bad" }]) expect((await validate(plainToInstance(BriefEventCalendarQueryDto, input))).length).toBeGreaterThan(0);
  });
});
