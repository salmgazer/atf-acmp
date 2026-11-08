import "reflect-metadata";
import * as Papa from "papaparse";
import { Reflector } from "@nestjs/core";
import { ForbiddenException } from "@nestjs/common";
import { parseSubmissionCsv } from "./submission-import-parser";
import { SubmissionImportService } from "./submission-import.service";
import { OrganizationsController } from "./organizations.controller";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { submissionFixture } from "./__fixtures__/partner-submissions";
import { sectorToIndustry } from "@acmp/shared";

describe("Partner submission CSV validation", () => {
  it("maps sectors to industry without losing Other details or local government wording", () => {
    expect(sectorToIndustry("Healthcare")).toBe("Healthcare");
    expect(sectorToIndustry("Other", "Telecommunication")).toBe("Telecommunication");
    expect(sectorToIndustry("Local/Municipal Government")).toBe("Local/Municipal Government");
  });
  it("parses quoted multiline fields, multiple submissions, source contacts and incomplete impact without losing text", async () => {
    const fixture = submissionFixture();
    fixture.rows[0]["The opportunity and who it affects"] = 'Quoted "challenge", details\n' + "a".repeat(7800);
    fixture.rows[0]["Records and data that exist"] = "b".repeat(13000);
    const result = await parseSubmissionCsv(fixture.csv(), "Africa/Accra");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].opportunity.description).toBe(fixture.rows[0]["The opportunity and who it affects"]);
    expect(result.rows[0].opportunity.dataDescription).toHaveLength(13000);
    expect(result.rows[0].scores).toMatchObject({ fitScore: 95, impactScore: 4 });
    expect(result.rows[1].scores.impactScore).toBeNull();
    expect(result.rows[0].submittedAt.toISOString()).toBe("2026-11-04T08:17:18.000Z");
    expect(result.warnings).toHaveLength(1);
  });
  it("rejects unknown answers and mismatched stored scores instead of replacing them", async () => {
    const fixture = submissionFixture();
    fixture.rows[0]["Q1 answer"] = "Unknown answer";
    fixture.rows[2]["AI-Challenge Fit Score"] = "1";
    const result = await parseSubmissionCsv(fixture.csv(), "Africa/Accra");
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ row: 2, message: expect.stringContaining("Unrecognized") }), expect.objectContaining({ row: 4, message: expect.stringContaining("Fit Score") })]));
  });
  it("rejects duplicate or partial sessions, invalid emails and inconsistent submitter records", async () => {
    const fixture = submissionFixture();
    fixture.rows[1]["Email"] = "bad-email";
    fixture.rows[1]["Opportunity #"] = "1";
    const result = await parseSubmissionCsv(fixture.csv(), "Africa/Accra");
    expect(result.errors.some(error => error.message.includes("inconsistent"))).toBe(true);
    expect(result.errors.some(error => error.message.includes("email"))).toBe(true);
    expect((await parseSubmissionCsv(Papa.unparse([fixture.rows[0]]), "Africa/Accra")).errors.some(error => error.message.includes("incomplete"))).toBe(true);
  });
  it("requires original headers, a valid timezone and at most 500 rows", async () => {
    await expect(parseSubmissionCsv("name,email\nPartner,p@example.test", "Africa/Accra")).rejects.toThrow("column headers");
    await expect(parseSubmissionCsv(submissionFixture().csv(), "invalid/zone")).rejects.toThrow("timezone");
    const row = submissionFixture().rows[0];
    await expect(parseSubmissionCsv(Papa.unparse(Array.from({ length: 501 }, () => row)), "Africa/Accra")).rejects.toThrow("500");
  });
});

describe("Partner submission import permissions", () => {
  for (const role of ["super_admin", "program_manager", "viewer", "evaluator", "organization", "mentor", "participant"]) it(`${role} has the expected preview/apply permissions`, async () => {
    const allowed = ["super_admin", "program_manager"].includes(role);
    for (const method of ["previewSubmissions", "applySubmissions"] as const) {
      const context = { getClass: () => OrganizationsController, getHandler: () => OrganizationsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role } }) }) } as any;
      const guard = new RolesGuard(new Reflector());
      if (allowed) expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    }
    if (!allowed) {
      const service = new SubmissionImportService({} as any);
      await expect(service.preview({} as any, { id: "u", role })).rejects.toThrow(ForbiddenException);
      await expect(service.apply({} as any, { id: "u", role })).rejects.toThrow(ForbiddenException);
    }
  });
});
