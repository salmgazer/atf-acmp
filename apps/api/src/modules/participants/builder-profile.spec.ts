import "reflect-metadata";
import { isQualifiedBuilder, validateBuilderProfile, languagePrefill, recordedProgrammingLanguages } from "@acmp/shared";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ConfirmBuilderProfileDto } from "./dto/builder-profile.dto";
describe("Language-neutral builder answers", () => {
  const answers = { preferredLanguage: "Other", otherLanguage: "Elixir", languageProficiency: "Beginner", developmentExperience: true, testingExperience: true, deploymentExperience: true };
  it.each(Array.from({ length: 8 }, (_, mask) => mask))("uses all three experiences, independent of proficiency, role, confirmation or Python: %s", mask => {
    expect(isQualifiedBuilder({ ...answers, languageProficiency: "Beginner", pythonSkill: "Expert", codeLabsCompleted: true, builderConfirm: false, developmentExperience: !!(mask & 1), testingExperience: !!(mask & 2), deploymentExperience: !!(mask & 4) })).toBe(mask === 7);
  });
  it("requires an Other language name, an informational proficiency and explicit answers", () => {
    expect(validateBuilderProfile(answers)).toBeNull();
    expect(validateBuilderProfile({ ...answers, otherLanguage: " " })).toContain("preferred programming language");
    expect(validateBuilderProfile({ ...answers, deploymentExperience: null })).toContain("Answer Yes or No");
    expect(validateBuilderProfile({ ...answers, languageProficiency: "" })).toContain("proficiency");
    expect(validateBuilderProfile({ preferredLanguage: "", developmentExperience: false, testingExperience: false, deploymentExperience: false })).toBeNull();
  });
  it("preserves explicit false answers even with implicit class conversion enabled", async () => {
    const dto = plainToInstance(ConfirmBuilderProfileDto, { ...answers, expectedUpdatedAt: new Date().toISOString(), testingExperience: false, deploymentExperience: "false" }, { enableImplicitConversion: true });
    expect(await validate(dto)).toEqual([]); expect(dto.testingExperience).toBe(false); expect(dto.deploymentExperience).toBe(false);
  });
  it("maps a single recorded language but leaves combined tags for participants to choose", () => {
    expect(languagePrefill({ skills: ["JavaScript"], pythonSkill: "Expert" })).toEqual({ preferredLanguage: "JavaScript", languageProficiency: null });
    expect(languagePrefill({ skills: ["JavaScript/TypeScript"] })).toEqual({ preferredLanguage: null, languageProficiency: null });
    expect(recordedProgrammingLanguages(["C/C++", "SQL", "Research"])).toEqual(["C", "C++", "SQL"]);
    expect(languagePrefill({ pythonSkill: "Beginner — basic syntax" })).toEqual({ preferredLanguage: "Python", languageProficiency: "Beginner" });
    expect(languagePrefill({ skills: ["Python", "R"], pythonSkill: "Advanced" })).toEqual({ preferredLanguage: null, languageProficiency: null });
  });

});
