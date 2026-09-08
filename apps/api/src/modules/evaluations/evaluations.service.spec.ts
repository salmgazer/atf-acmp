import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { getQueueToken } from "@nestjs/bullmq";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { EvaluationsService } from "./evaluations.service";
import {
  Evaluation,
  EvaluationJob,
  EvaluationJobStatus,
} from "@/database/entities/evaluation.entity";
import { Submission, SubmissionStatus } from "@/database/entities/stage.entity";
import { Team } from "@/database/entities/team.entity";
import { EVALUATION_QUEUE_NAME } from "./evaluation.constants";
import {
  createMockRepository,
  createMockQueryBuilder,
} from "../../../test/utils/test-utils";

describe("EvaluationsService", () => {
  let service: EvaluationsService;
  let evaluationRepo: ReturnType<typeof createMockRepository>;
  let evaluationJobRepo: ReturnType<typeof createMockRepository>;
  let submissionRepo: ReturnType<typeof createMockRepository>;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let mockQueue: any;

  const mockSubmission = {
    id: "submission-1",
    teamId: "team-1",
    stageId: "stage-1",
    status: SubmissionStatus.SUBMITTED,
    team: { id: "team-1", name: "Test Team" },
  };

  const mockTeam = {
    id: "team-1",
    name: "Test Team",
    cohortId: "cohort-1",
  };

  const mockEvaluationJob = {
    id: "job-1",
    teamId: "team-1",
    stageId: "stage-1",
    cohortId: "cohort-1",
    status: EvaluationJobStatus.PENDING,
    canRetry: jest.fn().mockReturnValue(true),
  };

  const mockEvaluation = {
    id: "eval-1",
    teamId: "team-1",
    stageId: "stage-1",
    cohortId: "cohort-1",
    aiScores: [{ criteriaId: "c1", score: 8, maxScore: 10 }],
    aiOverallScore: 80,
    aiEvaluatedAt: new Date(),
    humanScores: null,
    humanOverallScore: null,
    humanEvaluatedAt: null,
    finalScore: 80,
    isPublished: false,
    aiWeight: 0.7,
    calculateFinalScore: jest.fn().mockReturnValue(80),
  };

  beforeEach(async () => {
    evaluationRepo = createMockRepository();
    evaluationJobRepo = createMockRepository();
    submissionRepo = createMockRepository();
    teamRepo = createMockRepository();

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: "bull-job-1" }),
      getJob: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(5),
      getActiveCount: jest.fn().mockResolvedValue(2),
      getCompletedCount: jest.fn().mockResolvedValue(100),
      getFailedCount: jest.fn().mockResolvedValue(3),
      getDelayedCount: jest.fn().mockResolvedValue(1),
      isPaused: jest.fn().mockResolvedValue(false),
      pause: jest.fn(),
      resume: jest.fn(),
      drain: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(EvaluationJob), useValue: evaluationJobRepo },
        { provide: getRepositoryToken(Submission), useValue: submissionRepo },
        { provide: getRepositoryToken(Team), useValue: teamRepo },
        { provide: getQueueToken(EVALUATION_QUEUE_NAME), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<EvaluationsService>(EvaluationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("triggerBatchEvaluation", () => {
    it("should queue evaluations for submitted teams", async () => {
      submissionRepo.find.mockResolvedValue([mockSubmission]);
      evaluationRepo.find.mockResolvedValue([]); // No existing evaluations
      evaluationJobRepo.findOne.mockResolvedValue(null); // No existing jobs
      evaluationJobRepo.create.mockReturnValue(mockEvaluationJob);
      evaluationJobRepo.save.mockResolvedValue(mockEvaluationJob);

      const result = await service.triggerBatchEvaluation({
        cohortId: "cohort-1",
        stageId: "stage-1",
      });

      expect(result.queued).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it("should skip teams with completed evaluations", async () => {
      submissionRepo.find.mockResolvedValue([mockSubmission]);
      evaluationRepo.find.mockResolvedValue([
        { teamId: "team-1", aiEvaluatedAt: new Date() },
      ]);

      const result = await service.triggerBatchEvaluation({
        cohortId: "cohort-1",
        stageId: "stage-1",
      });

      expect(result.queued).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should skip teams with pending jobs", async () => {
      submissionRepo.find.mockResolvedValue([mockSubmission]);
      evaluationRepo.find.mockResolvedValue([]);
      evaluationJobRepo.findOne.mockResolvedValue(mockEvaluationJob); // Existing pending job

      const result = await service.triggerBatchEvaluation({
        cohortId: "cohort-1",
        stageId: "stage-1",
      });

      expect(result.queued).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("should filter by specific teamIds when provided", async () => {
      const submission1 = { ...mockSubmission, teamId: "team-1" };
      const submission2 = { ...mockSubmission, id: "sub-2", teamId: "team-2" };

      submissionRepo.find.mockResolvedValue([submission1, submission2]);
      evaluationRepo.find.mockResolvedValue([]);
      evaluationJobRepo.findOne.mockResolvedValue(null);
      evaluationJobRepo.create.mockReturnValue(mockEvaluationJob);
      evaluationJobRepo.save.mockResolvedValue(mockEvaluationJob);

      const result = await service.triggerBatchEvaluation({
        cohortId: "cohort-1",
        stageId: "stage-1",
        teamIds: ["team-1"], // Only team-1
      });

      expect(result.queued).toBe(1);
    });
  });

  describe("triggerSingleEvaluation", () => {
    it("should queue evaluation for a single team", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      evaluationJobRepo.findOne.mockResolvedValue(null);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      evaluationJobRepo.create.mockReturnValue(mockEvaluationJob);
      evaluationJobRepo.save.mockResolvedValue(mockEvaluationJob);

      const result = await service.triggerSingleEvaluation({
        teamId: "team-1",
        stageId: "stage-1",
      });

      expect(result.id).toBe("job-1");
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it("should throw NotFoundException if no submission found", async () => {
      submissionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.triggerSingleEvaluation({ teamId: "team-1", stageId: "stage-1" })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException for draft submissions", async () => {
      submissionRepo.findOne.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.DRAFT,
      });

      await expect(
        service.triggerSingleEvaluation({ teamId: "team-1", stageId: "stage-1" })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if evaluation already in progress", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      evaluationJobRepo.findOne.mockResolvedValue(mockEvaluationJob);

      await expect(
        service.triggerSingleEvaluation({ teamId: "team-1", stageId: "stage-1" })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if team not found", async () => {
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      evaluationJobRepo.findOne.mockResolvedValue(null);
      teamRepo.findOne.mockResolvedValue(null);

      await expect(
        service.triggerSingleEvaluation({ teamId: "team-1", stageId: "stage-1" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("retryFailedJob", () => {
    it("should retry a failed job", async () => {
      const failedJob = {
        ...mockEvaluationJob,
        status: EvaluationJobStatus.FAILED,
        canRetry: jest.fn().mockReturnValue(true),
      };
      evaluationJobRepo.findOne.mockResolvedValue(failedJob);
      evaluationJobRepo.save.mockResolvedValue({
        ...failedJob,
        status: EvaluationJobStatus.PENDING,
      });

      const result = await service.retryFailedJob("job-1");

      expect(result.status).toBe(EvaluationJobStatus.PENDING);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it("should throw NotFoundException if job not found", async () => {
      evaluationJobRepo.findOne.mockResolvedValue(null);

      await expect(service.retryFailedJob("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw BadRequestException if job cannot be retried", async () => {
      const nonRetryableJob = {
        ...mockEvaluationJob,
        canRetry: jest.fn().mockReturnValue(false),
      };
      evaluationJobRepo.findOne.mockResolvedValue(nonRetryableJob);

      await expect(service.retryFailedJob("job-1")).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("cancelJob", () => {
    it("should cancel a pending job", async () => {
      const pendingJob = { ...mockEvaluationJob, bullJobId: "bull-1" };
      evaluationJobRepo.findOne.mockResolvedValue(pendingJob);
      mockQueue.getJob.mockResolvedValue({ remove: jest.fn() });
      evaluationJobRepo.save.mockResolvedValue({
        ...pendingJob,
        status: EvaluationJobStatus.CANCELLED,
      });

      const result = await service.cancelJob("job-1");

      expect(result.status).toBe(EvaluationJobStatus.CANCELLED);
    });

    it("should throw NotFoundException if job not found", async () => {
      evaluationJobRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelJob("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw BadRequestException for completed jobs", async () => {
      evaluationJobRepo.findOne.mockResolvedValue({
        ...mockEvaluationJob,
        status: EvaluationJobStatus.COMPLETED,
      });

      await expect(service.cancelJob("job-1")).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("getEvaluations", () => {
    it("should return paginated evaluations", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockEvaluation], 1]);
      evaluationRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getEvaluations({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("should filter by cohortId", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      evaluationRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getEvaluations({ cohortId: "cohort-1" });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "evaluation.cohortId = :cohortId",
        { cohortId: "cohort-1" }
      );
    });

    it("should filter by needsHumanReview", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      evaluationRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getEvaluations({ needsHumanReview: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "evaluation.aiEvaluatedAt IS NOT NULL"
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "evaluation.humanEvaluatedAt IS NULL"
      );
    });
  });

  describe("getEvaluation", () => {
    it("should return evaluation by id", async () => {
      evaluationRepo.findOne.mockResolvedValue(mockEvaluation);

      const result = await service.getEvaluation("eval-1");

      expect(result.id).toBe("eval-1");
    });

    it("should throw NotFoundException if not found", async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(service.getEvaluation("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("getEvaluationForTeam", () => {
    it("should return evaluation for team and stage", async () => {
      evaluationRepo.findOne.mockResolvedValue(mockEvaluation);

      const result = await service.getEvaluationForTeam("team-1", "stage-1");

      expect(result?.teamId).toBe("team-1");
    });

    it("should return null if not found", async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      const result = await service.getEvaluationForTeam("team-1", "stage-1");

      expect(result).toBeNull();
    });
  });

  describe("getJobs", () => {
    it("should return paginated jobs", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockEvaluationJob], 1]);
      evaluationJobRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getJobs({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter by status", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      evaluationJobRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getJobs({ status: EvaluationJobStatus.FAILED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "job.status = :status",
        { status: EvaluationJobStatus.FAILED }
      );
    });
  });

  describe("getJob", () => {
    it("should return job by id", async () => {
      evaluationJobRepo.findOne.mockResolvedValue(mockEvaluationJob);

      const result = await service.getJob("job-1");

      expect(result.id).toBe("job-1");
    });

    it("should throw NotFoundException if not found", async () => {
      evaluationJobRepo.findOne.mockResolvedValue(null);

      await expect(service.getJob("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("getQueueStatus", () => {
    it("should return queue status", async () => {
      const result = await service.getQueueStatus();

      expect(result.waiting).toBe(5);
      expect(result.active).toBe(2);
      expect(result.completed).toBe(100);
      expect(result.failed).toBe(3);
      expect(result.delayed).toBe(1);
      expect(result.paused).toBe(false);
    });
  });

  describe("pauseQueue / resumeQueue", () => {
    it("should pause the queue", async () => {
      await service.pauseQueue();
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it("should resume the queue", async () => {
      await service.resumeQueue();
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe("clearQueue", () => {
    it("should clear the queue", async () => {
      const result = await service.clearQueue();
      expect(mockQueue.drain).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe("getStageStats", () => {
    it("should return stage statistics", async () => {
      submissionRepo.count.mockResolvedValue(10);
      evaluationRepo.find.mockResolvedValue([
        { id: "e1", aiEvaluatedAt: new Date(), finalScore: 75 },
        { id: "e2", aiEvaluatedAt: new Date(), finalScore: 85 },
      ]);
      evaluationJobRepo.find.mockResolvedValue([
        { status: EvaluationJobStatus.COMPLETED, processingTimeMs: 5000 },
        { status: EvaluationJobStatus.COMPLETED, processingTimeMs: 3000 },
        { status: EvaluationJobStatus.FAILED },
      ]);

      const result = await service.getStageStats("cohort-1", "stage-1");

      expect(result.totalTeams).toBe(10);
      expect(result.evaluated).toBe(2);
      expect(result.pending).toBe(8);
      expect(result.failed).toBe(1);
      expect(result.averageScore).toBe(80);
      expect(result.averageProcessingTime).toBe(4000);
    });
  });

  describe("submitHumanScore", () => {
    it("should submit human scores and calculate final score", async () => {
      const evalWithCalc = {
        ...mockEvaluation,
        calculateFinalScore: jest.fn().mockReturnValue(82),
      };
      evaluationRepo.findOne.mockResolvedValue(evalWithCalc);
      evaluationRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.submitHumanScore(
        "eval-1",
        {
          scores: [{ criterionId: "c1", criterionName: "Criterion 1", score: 9, maxScore: 10 }],
          feedback: "Great work!",
        },
        "evaluator-1"
      );

      expect(result.humanScores).toHaveLength(1);
      expect(result.humanFeedback).toBe("Great work!");
      expect(result.humanEvaluatorId).toBe("evaluator-1");
      expect(result.humanEvaluatedAt).toBeDefined();
      expect(evalWithCalc.calculateFinalScore).toHaveBeenCalled();
    });

    it("should throw NotFoundException if evaluation not found", async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitHumanScore(
          "non-existent",
          { scores: [], feedback: "" },
          "evaluator-1"
        )
      ).rejects.toThrow(NotFoundException);
    });

    it("should calculate weighted human score correctly", async () => {
      const evalWithCalc = {
        ...mockEvaluation,
        calculateFinalScore: jest.fn().mockReturnValue(85),
      };
      evaluationRepo.findOne.mockResolvedValue(evalWithCalc);
      evaluationRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.submitHumanScore(
        "eval-1",
        {
          scores: [
            { criterionId: "c1", criterionName: "Criterion 1", score: 8, maxScore: 10 },
            { criterionId: "c2", criterionName: "Criterion 2", score: 9, maxScore: 10 },
          ],
          feedback: "Good",
        },
        "evaluator-1"
      );

      // (8 + 9) / (10 + 10) * 100 = 85
      expect(result.humanOverallScore).toBe(85);
    });
  });

  describe("publishEvaluations", () => {
    it("should publish multiple evaluations", async () => {
      evaluationRepo.update.mockResolvedValue({ affected: 3, raw: {}, generatedMaps: [] });

      const result = await service.publishEvaluations(["e1", "e2", "e3"]);

      expect(result).toBe(3);
      expect(evaluationRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isPublished: true })
      );
    });
  });

  describe("unpublishEvaluations", () => {
    it("should unpublish multiple evaluations", async () => {
      evaluationRepo.update.mockResolvedValue({ affected: 2, raw: {}, generatedMaps: [] });

      const result = await service.unpublishEvaluations(["e1", "e2"]);

      expect(result).toBe(2);
      expect(evaluationRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isPublished: false })
      );
    });
  });

  describe("updateAIWeight", () => {
    it("should update AI weight and recalculate final score", async () => {
      const evalWithCalc = {
        ...mockEvaluation,
        calculateFinalScore: jest.fn().mockReturnValue(78),
      };
      evaluationRepo.findOne.mockResolvedValue(evalWithCalc);
      evaluationRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.updateAIWeight("eval-1", 0.5);

      expect(result.aiWeight).toBe(0.5);
      expect(evalWithCalc.calculateFinalScore).toHaveBeenCalled();
    });

    it("should throw NotFoundException if evaluation not found", async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(service.updateAIWeight("non-existent", 0.5)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
