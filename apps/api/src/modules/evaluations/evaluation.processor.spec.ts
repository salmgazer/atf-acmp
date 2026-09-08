import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Job } from "bullmq";
import { EvaluationProcessor, EvaluationJobData } from "./evaluation.processor";
import {
  Evaluation,
  EvaluationJob,
  EvaluationJobStatus,
} from "@/database/entities/evaluation.entity";
import { Submission, SubmissionStatus, Stage } from "@/database/entities/stage.entity";
import { Team } from "@/database/entities/team.entity";
import { GeminiService } from "./gemini.service";
import { GitHubService } from "@/modules/github/github.service";
import { EVALUATION_STEPS } from "./evaluation.constants";
import { createMockRepository } from "../../../test/utils/test-utils";

describe("EvaluationProcessor", () => {
  let processor: EvaluationProcessor;
  let evaluationRepo: ReturnType<typeof createMockRepository>;
  let evaluationJobRepo: ReturnType<typeof createMockRepository>;
  let submissionRepo: ReturnType<typeof createMockRepository>;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let stageRepo: ReturnType<typeof createMockRepository>;
  let geminiService: any;
  let githubService: any;

  const mockJobData: EvaluationJobData = {
    teamId: "team-1",
    stageId: "stage-1",
    cohortId: "cohort-1",
    evaluationJobId: "job-1",
  };

  const mockSubmission = {
    id: "submission-1",
    teamId: "team-1",
    stageId: "stage-1",
    status: SubmissionStatus.SUBMITTED,
    fileUrls: [{ name: "doc.pdf", extractedText: "Test content" }],
    githubUrl: "https://github.com/test/repo",
    videoUrl: "https://youtube.com/watch?v=123",
    content: "Additional submission content",
    team: { id: "team-1", name: "Test Team" },
  };

  const mockTeam = {
    id: "team-1",
    name: "Test Team",
    cohortId: "cohort-1",
  };

  const mockStage = {
    id: "stage-1",
    number: 1,
    name: "Stage 1",
    evaluationCriteria: [
      { id: "innovation", name: "Innovation", maxScore: 10, weight: 25 },
      { id: "feasibility", name: "Feasibility", maxScore: 10, weight: 25 },
    ],
  };

  const mockEvaluation = {
    id: "eval-1",
    teamId: "team-1",
    stageId: "stage-1",
    cohortId: "cohort-1",
    calculateFinalScore: jest.fn().mockReturnValue(80),
  };

  const mockAIResult = {
    scores: [
      { criteriaId: "innovation", score: 8, maxScore: 10, feedback: "Good innovation" },
      { criteriaId: "feasibility", score: 7, maxScore: 10, feedback: "Feasible" },
    ],
    overallScore: 75,
    feedback: "Overall good submission",
    strengths: ["Creative approach", "Clear documentation"],
    improvements: ["More market research needed"],
    tokensUsed: 1500,
  };

  const mockCodeAnalysis = {
    repoUrl: "https://github.com/test/repo",
    languages: ["TypeScript", "JavaScript"],
    fileCount: 50,
    totalLines: 5000,
    commits: [
      { message: "Initial commit", date: "2024-01-01", author: "dev" },
    ],
    readmeContent: "# Test Project",
    structure: "src/\n  index.ts\n  app.ts",
  };

  beforeEach(async () => {
    evaluationRepo = createMockRepository();
    evaluationJobRepo = createMockRepository();
    submissionRepo = createMockRepository();
    teamRepo = createMockRepository();
    stageRepo = createMockRepository();

    geminiService = {
      isAvailable: jest.fn().mockReturnValue(true),
      evaluateSubmission: jest.fn().mockResolvedValue(mockAIResult),
      analyzeCodeQuality: jest.fn().mockResolvedValue({ codeQuality: 85, tokensUsed: 500 }),
      estimateCost: jest.fn().mockReturnValue(0.05),
    };

    githubService = {
      getRepositoryInfo: jest.fn().mockResolvedValue({ name: "repo", stars: 10 }),
      getRecentCommits: jest.fn().mockResolvedValue([
        { commit: { message: "feat: add feature", author: { date: "2024-01-01", name: "dev" } } },
      ]),
      getLanguages: jest.fn().mockResolvedValue({ TypeScript: 8000, JavaScript: 2000 }),
      getReadme: jest.fn().mockResolvedValue("# Test Project"),
      getFileStructure: jest.fn().mockResolvedValue([{ path: "src/index.ts" }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationProcessor,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(EvaluationJob), useValue: evaluationJobRepo },
        { provide: getRepositoryToken(Submission), useValue: submissionRepo },
        { provide: getRepositoryToken(Team), useValue: teamRepo },
        { provide: getRepositoryToken(Stage), useValue: stageRepo },
        { provide: GeminiService, useValue: geminiService },
        { provide: GitHubService, useValue: githubService },
      ],
    }).compile();

    processor = module.get<EvaluationProcessor>(EvaluationProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockJob = (data: EvaluationJobData, attemptsMade = 0): Job<EvaluationJobData> => ({
    id: "bull-job-1",
    data,
    attemptsMade,
  } as Job<EvaluationJobData>);

  describe("process", () => {
    it("should successfully process an evaluation job", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      // Verify job status updates
      expect(evaluationJobRepo.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          status: EvaluationJobStatus.PROCESSING,
          currentStep: EVALUATION_STEPS.FETCH_SUBMISSION,
        })
      );

      // Verify final completion
      expect(evaluationJobRepo.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          status: EvaluationJobStatus.COMPLETED,
          progress: 100,
        })
      );

      // Verify evaluation was saved
      expect(evaluationRepo.save).toHaveBeenCalled();
    });

    it("should throw error if no submission found", async () => {
      submissionRepo.findOne.mockResolvedValue(null);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await expect(processor.process(job)).rejects.toThrow("No submission found for team");

      expect(evaluationJobRepo.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          status: EvaluationJobStatus.FAILED,
          error: "No submission found for team",
        })
      );
    });

    it("should throw error if team not found", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(null);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await expect(processor.process(job)).rejects.toThrow("Team or stage not found");
    });

    it("should throw error if stage not found", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(null);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await expect(processor.process(job)).rejects.toThrow("Team or stage not found");
    });

    it("should skip GitHub analysis if no GitHub URL", async () => {
      const submissionWithoutGithub = { ...mockSubmission, githubUrl: null };
      submissionRepo.findOne.mockResolvedValue(submissionWithoutGithub);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(githubService.getRepositoryInfo).not.toHaveBeenCalled();
    });

    it("should handle GitHub analysis failure gracefully", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      // Make GitHub service fail
      githubService.getRepositoryInfo.mockRejectedValue(new Error("GitHub API error"));

      const job = createMockJob(mockJobData);

      // Should not throw - should continue without GitHub data
      await processor.process(job);

      expect(evaluationRepo.save).toHaveBeenCalled();
    });

    it("should skip AI evaluation if Gemini not available", async () => {
      geminiService.isAvailable.mockReturnValue(false);
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(geminiService.evaluateSubmission).not.toHaveBeenCalled();
      expect(evaluationRepo.save).toHaveBeenCalled();
    });

    it("should update existing evaluation if found", async () => {
      const existingEvaluation = { ...mockEvaluation };
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(existingEvaluation);
      evaluationRepo.save.mockResolvedValue(existingEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(evaluationRepo.create).not.toHaveBeenCalled();
      expect(evaluationRepo.save).toHaveBeenCalled();
    });

    it("should track processing time", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(evaluationJobRepo.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          status: EvaluationJobStatus.COMPLETED,
          processingTimeMs: expect.any(Number),
        })
      );
    });

    it("should record attempt count on failure", async () => {
      submissionRepo.findOne.mockResolvedValue(null);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData, 2); // Already tried 2 times

      await expect(processor.process(job)).rejects.toThrow();

      expect(evaluationJobRepo.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          status: EvaluationJobStatus.FAILED,
          attempts: 3, // attemptsMade + 1
        })
      );
    });
  });

  describe("progress updates", () => {
    it("should update progress through all steps", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      // Verify progress updates through steps
      const updateCalls = evaluationJobRepo.update.mock.calls;
      const progressUpdates = updateCalls
        .filter((call: any) => call[1].progress !== undefined)
        .map((call: any) => ({ progress: call[1].progress, step: call[1].currentStep }));

      expect(progressUpdates.some((u) => u.progress === 10)).toBe(true);
      expect(progressUpdates.some((u) => u.progress === 100)).toBe(true);
    });
  });

  describe("GitHub URL parsing", () => {
    it("should parse standard GitHub URL", async () => {
      submissionRepo.findOne.mockResolvedValue({
        ...mockSubmission,
        githubUrl: "https://github.com/owner/repo",
      });
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(githubService.getRepositoryInfo).toHaveBeenCalledWith("owner", "repo");
    });

    it("should handle GitHub URL with .git suffix", async () => {
      submissionRepo.findOne.mockResolvedValue({
        ...mockSubmission,
        githubUrl: "https://github.com/owner/repo.git",
      });
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(githubService.getRepositoryInfo).toHaveBeenCalledWith("owner", "repo");
    });

    it("should skip analysis for invalid GitHub URL", async () => {
      submissionRepo.findOne.mockResolvedValue({
        ...mockSubmission,
        githubUrl: "https://invalid-url.com/not-github",
      });
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(mockStage);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(githubService.getRepositoryInfo).not.toHaveBeenCalled();
    });
  });

  describe("rubric building", () => {
    it("should use stage evaluation criteria if defined", async () => {
      const stageWithCriteria = {
        ...mockStage,
        evaluationCriteria: [
          { id: "custom1", name: "Custom Criteria", maxScore: 10, weight: 50 },
        ],
      };

      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(stageWithCriteria);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(geminiService.evaluateSubmission).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          criteria: stageWithCriteria.evaluationCriteria,
        }),
        expect.anything()
      );
    });

    it("should use default criteria if stage has none", async () => {
      const stageWithoutCriteria = { ...mockStage, evaluationCriteria: undefined };

      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      stageRepo.findOne.mockResolvedValue(stageWithoutCriteria);
      evaluationRepo.findOne.mockResolvedValue(null);
      evaluationRepo.create.mockReturnValue(mockEvaluation);
      evaluationRepo.save.mockResolvedValue(mockEvaluation);
      evaluationJobRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const job = createMockJob(mockJobData);

      await processor.process(job);

      expect(geminiService.evaluateSubmission).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          criteria: expect.arrayContaining([
            expect.objectContaining({ id: "innovation" }),
            expect.objectContaining({ id: "feasibility" }),
            expect.objectContaining({ id: "presentation" }),
            expect.objectContaining({ id: "impact" }),
          ]),
        }),
        expect.anything()
      );
    });
  });

  describe("event handlers", () => {
    it("should log on completed event", () => {
      const logSpy = jest.spyOn(processor["logger"], "log");
      const job = createMockJob(mockJobData);

      processor.onCompleted(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("completed successfully")
      );
    });

    it("should log error on failed event", () => {
      const errorSpy = jest.spyOn(processor["logger"], "error");
      const job = createMockJob(mockJobData);
      const error = new Error("Test error");

      processor.onFailed(job, error);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("failed: Test error")
      );
    });
  });
});
