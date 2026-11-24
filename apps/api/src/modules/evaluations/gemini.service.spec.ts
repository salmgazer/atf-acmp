import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { GeminiService } from "./gemini.service";
describe("AI rubric identifier contract", () => {
  const rubric = { criteria: [{ id: "warmup_web_app", name: "Deployed web application", description: "Source and deployment evidence", maxScore: 1, weight: 100 }] };
  const submission = { teamName: "Synthetic team", stageNumber: 4, stageName: "Team warmup" };
  it("supplies the exact machine identifiers required by the score validator", () => {
    const prompt = (new GeminiService(new ConfigService()) as any).buildSubmissionEvaluationPrompt(submission, rubric);
    expect(prompt).toContain("ID warmup_web_app: Deployed web application");
    expect(prompt).toContain("using the exact criterion IDs shown above");
  });
  it("validates and records a structured single-criterion AI response", async () => {
    const service = new GeminiService(new ConfigService());
    (service as any).isConfigured = true;
    (service as any).model = { generateContent: jest.fn().mockResolvedValue({ response: { text: () => JSON.stringify({ scores: [{ criterionId: "warmup_web_app", criterionName: "Deployed web application", score: 1, maxScore: 1, explanation: "Source and reachable page support the app", confidence: 0.9 }], overallFeedback: "Evidence reviewed", strengths: ["Deployment"], improvements: ["More testing"], overallConfidence: 0.9 }) } }) };
    await expect(service.evaluateSubmission(submission, rubric)).resolves.toMatchObject({ overallScore: 100, feedback: "Evidence reviewed", scores: [{ criterionId: "warmup_web_app", score: 1 }] });
  });
});
