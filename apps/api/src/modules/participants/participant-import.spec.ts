import "reflect-metadata";
import * as Papa from "papaparse";
import { ForbiddenException, GoneException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { parseParticipantCsv } from "./participant-import-parser";
import { ParticipantImportDto } from "./dto/participant-import.dto";
import { ParticipantsController } from "./participants.controller";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { ParticipantImportService } from "./participant-import.service";

describe("Participant learning CSV parsing", () => {
  const csv = (values: Record<string, string>) => Papa.unparse([values]);
  it("accepts ATF headers, quoted values, dates, opaque IDs, booleans and phone strings", () => {
    const parsed = parseParticipantCsv("\uFEFF" + csv({ participant_id: "external-person-id", first_name: "Example", last_name: "Learner", lms_email: "LEARNER@EXAMPLE.TEST", country: "GH", institution_name_clean: 'University, "Research"\nCampus', phone: "+233200000001", halfway_reached: "Yes", finished_all_lessons: "No", certificate: "Yes", certificate_id: "AbCdEfGhIjKlMnOpQrStUvWx", certificate_date: "2026-11-06", github_username: "https://github.com/example-user/" }));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ participantId: "external-person-id", lmsEmail: "learner@example.test", country: "Ghana", values: { institution: 'University, "Research"\nCampus', phoneNumber: "+233200000001", learningHalfwayReached: true, learningFinishedAllLessons: false, learningCertificateId: "AbCdEfGhIjKlMnOpQrStUvWx", learningCertificateDate: "2026-11-06", githubUsername: "example-user" } });
    expect(parsed.rows[0].warnings).toContain("Certificate issued but lessons are marked unfinished; both values will be preserved");
  });
  it("leaves blanks undefined while preserving explicit No and normalizes legacy header aliases", () => {
    const row = parseParticipantCsv(csv({ participantId: "legacy-id", email: "legacy@example.test", institution: "", certificate: "No", finished_all_lessons: "false", halfway_reached: "1" })).rows[0];
    expect(row.values).toEqual({ learningCertificateIssued: false, learningFinishedAllLessons: false, learningHalfwayReached: true });
    expect(row.lmsEmail).toBe("legacy@example.test");
  });
  it("rejects ambiguous headers, invalid dates and unrecognized boolean values", () => {
    expect(parseParticipantCsv("participant_id,id\na,b").errors).toContain("More than one column maps to participantId; keep only one");
    const row = parseParticipantCsv(csv({ participant_id: "id", certificate_date: "2026-02-30", halfway_reached: "perhaps" })).rows[0];
    expect(row.errors).toEqual(expect.arrayContaining(["Certificate date must be a valid YYYY-MM-DD date", "learningHalfwayReached must be Yes/No or True/False"]));
  });
  it("preserves nonstandard GitHub data for review and does not interpret arbitrary CSV headers as writable fields", () => {
    const parsed = parseParticipantCsv(csv({ participant_id: "id", github_username: "Please ask me for my username", password_hash: "injected", status: "ready" }));
    expect(parsed.rows[0].values).toEqual({ githubUsername: "Please ask me for my username" });
    expect(parsed.rows[0].warnings).toHaveLength(1);
    expect(parsed.warnings).toHaveLength(2);
  });
  it("requires certificate metadata to agree with an explicit No", () => {
    expect(parseParticipantCsv(csv({ participant_id: "id", certificate: "No", certificate_id: "opaque-id" })).rows[0].errors).toContain("A certificate marked No cannot have an ID or date");
  });
});

describe("Participant import authorization and input boundaries", () => {
  it.each(["viewer", "evaluator", "mentor", "participant", "organization"])("denies %s import previews, application and receipts", role => {
    for (const method of ["previewImport", "applyImport", "importStatus"] as const) {
      const context = { getClass: () => ParticipantsController, getHandler: () => ParticipantsController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", role } }) }) } as any;
      expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(ForbiddenException);
    }
  });
  it("does not let the legacy endpoint bypass preview or reset existing accounts", async () => {
    const service = { bulkImport: jest.fn() };
    const controller = new ParticipantsController(service as any, {} as any, {} as any, {} as any);
    await expect(controller.bulkImport({ cohortId: "id", participants: [] })).rejects.toThrow(GoneException);
    expect(service.bulkImport).not.toHaveBeenCalled();
  });
  it("validates field selection and never implicitly treats a string false as true", async () => {
    const input = { cohortId: "074ae845-d4a8-4140-8f7b-6e67408fe5df", csv: "participant_id\nid", sourceName: "test.csv", allowLearningCorrections: "false" };
    const dto = plainToInstance(ParticipantImportDto, input, { enableImplicitConversion: true });
    expect(dto.allowLearningCorrections).toBe(false);
    expect(await validate(dto)).toHaveLength(0);
    expect((await validate(plainToInstance(ParticipantImportDto, { ...input, updateFields: ["passwordHash"] }))).length).toBeGreaterThan(0);
  });
  it("enforces service authorization even outside HTTP", async () => {
    const service = new ParticipantImportService({} as any, {} as any, {} as any);
    await expect(service.preview({ cohortId: "id", csv: "id", sourceName: "test.csv" }, { id: "u", role: "viewer" })).rejects.toThrow(ForbiddenException);
  });
});
