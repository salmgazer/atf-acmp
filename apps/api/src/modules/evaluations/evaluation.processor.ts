import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Evaluation,
  EvaluationJob,
  EvaluationJobStatus,
} from "@/database/entities/evaluation.entity";
import { Submission } from "@/database/entities/stage.entity";
import { Team } from "@/database/entities/team.entity";
import { Stage } from "@/database/entities/stage.entity";
import { GeminiService, SubmissionData, CodeAnalysisData } from "./gemini.service";
import { GitHubService } from "@/modules/github/github.service";
import {
  EVALUATION_QUEUE_NAME,
  EVALUATION_JOB_TYPES,
  EVALUATION_STEPS,
} from "./evaluation.constants";

export interface EvaluationJobData {
  teamId: string;
  stageId: string;
  cohortId: string;
  evaluationJobId: string;
}

@Processor(EVALUATION_QUEUE_NAME)
export class EvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(
    @InjectRepository(Evaluation)
    private evaluationRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationJob)
    private evaluationJobRepo: Repository<EvaluationJob>,
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(Stage)
    private stageRepo: Repository<Stage>,
    private geminiService: GeminiService,
    private githubService: GitHubService,
  ) {
    super();
  }

  async process(job: Job<EvaluationJobData>): Promise<void> {
    const { teamId, stageId, cohortId, evaluationJobId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing evaluation job ${job.id} for team ${teamId}`);

    try {
      // Update job status to processing
      await this.updateJobStatus(evaluationJobId, {
        status: EvaluationJobStatus.PROCESSING,
        bullJobId: job.id,
        startedAt: new Date(),
        currentStep: EVALUATION_STEPS.FETCH_SUBMISSION,
        progress: 10,
      });

      // Step 1: Fetch submission
      const submission = await this.fetchSubmission(teamId, stageId);
      if (!submission) {
        throw new Error("No submission found for team");
      }
      await this.updateJobProgress(evaluationJobId, 20, EVALUATION_STEPS.FETCH_GITHUB);

      // Step 2: Fetch team and stage info
      const team = await this.teamRepo.findOne({ where: { id: teamId } });
      const stage = await this.stageRepo.findOne({ where: { id: stageId } });

      if (!team || !stage) {
        throw new Error("Team or stage not found");
      }

      // Step 3: Analyze GitHub if available
      let codeAnalysis: CodeAnalysisData | undefined;
      if (submission.githubUrl) {
        await this.updateJobProgress(evaluationJobId, 30, EVALUATION_STEPS.ANALYZE_CODE);
        codeAnalysis = await this.analyzeGitHub(submission.githubUrl);
      }
      await this.updateJobProgress(evaluationJobId, 50, EVALUATION_STEPS.ANALYZE_DOCUMENTS);

      // Step 4: Prepare submission data for AI
      const submissionData = this.prepareSubmissionData(submission, team, stage);

      // Step 5: Get rubric from stage requirements
      const rubric = this.buildRubricFromStage(stage);
      await this.updateJobProgress(evaluationJobId, 60, EVALUATION_STEPS.GENERATE_SCORES);

      // Step 6: Run AI evaluation
      let aiResult;
      let metrics;

      if (this.geminiService.isAvailable()) {
        aiResult = await this.geminiService.evaluateSubmission(
          submissionData,
          rubric,
          codeAnalysis,
        );

        if (codeAnalysis) {
          metrics = await this.geminiService.analyzeCodeQuality(codeAnalysis);
          metrics.estimatedCost = this.geminiService.estimateCost(
            (aiResult.tokensUsed || 0) + (metrics.tokensUsed || 0),
          );
        }
      }

      await this.updateJobProgress(evaluationJobId, 80, EVALUATION_STEPS.SAVE_RESULTS);

      // Step 7: Save evaluation results
      await this.saveEvaluationResults(
        teamId,
        stageId,
        cohortId,
        aiResult,
        metrics,
      );

      // Mark job as completed
      const processingTime = Date.now() - startTime;
      await this.updateJobStatus(evaluationJobId, {
        status: EvaluationJobStatus.COMPLETED,
        completedAt: new Date(),
        progress: 100,
        currentStep: undefined,
        processingTimeMs: processingTime,
      });

      this.logger.log(
        `Completed evaluation job ${job.id} in ${processingTime}ms`,
      );
    } catch (error: any) {
      this.logger.error(`Failed evaluation job ${job.id}: ${error.message}`);

      await this.updateJobStatus(evaluationJobId, {
        status: EvaluationJobStatus.FAILED,
        error: error.message,
        errorStack: error.stack,
        attempts: job.attemptsMade + 1,
      });

      throw error; // Re-throw for BullMQ retry handling
    }
  }


  @OnWorkerEvent("completed")
  onCompleted(job: Job<EvaluationJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EvaluationJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  private async fetchSubmission(
    teamId: string,
    stageId: string,
  ): Promise<Submission | null> {
    return this.submissionRepo.findOne({
      where: { teamId, stageId },
      relations: ["team"],
    });
  }

  private async analyzeGitHub(githubUrl: string): Promise<CodeAnalysisData | undefined> {
    try {
      // Extract owner/repo from URL
      const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
      if (!match) {
        this.logger.warn(`Invalid GitHub URL: ${githubUrl}`);
        return undefined;
      }

      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");

      // Fetch repository data
      const repoData = await this.githubService.getRepositoryInfo(owner, repoName);
      const commits = await this.githubService.getRecentCommits(owner, repoName, 30);
      const languages = await this.githubService.getLanguages(owner, repoName);
      const readme = await this.githubService.getReadme(owner, repoName);
      const structure = await this.githubService.getFileStructure(owner, repoName);

      return {
        repoUrl: githubUrl,
        languages: Object.keys(languages || {}),
        fileCount: structure?.length || 0,
        totalLines: 0, // Would need deeper analysis
        commits: commits.map((c: any) => ({
          message: c.commit?.message || "",
          date: c.commit?.author?.date || "",
          author: c.commit?.author?.name || c.author?.login || "Unknown",
        })),
        readmeContent: readme || undefined,
        structure: structure?.slice(0, 50).map((f: any) => f.path).join("\n"),
      };
    } catch (error: any) {
      this.logger.warn(`Failed to analyze GitHub: ${error.message}`);
      return undefined;
    }
  }

  private prepareSubmissionData(
    submission: Submission,
    team: Team,
    stage: Stage,
  ): SubmissionData {
    return {
      teamName: team.name,
      projectName: team.name, // Use team name as project name
      stageNumber: stage.number,
      stageName: stage.name,
      documents: submission.fileUrls?.map((f: any) => ({
        name: f.name || "Document",
        content: f.extractedText || "[Document content not extracted]",
        type: f.type || "document",
      })),
      githubUrl: submission.githubUrl,
      videoUrl: submission.videoUrl,
      additionalContent: submission.content,
    };
  }

  private buildRubricFromStage(stage: Stage): { criteria: any[] } {
    // Use stage evaluation criteria if defined, otherwise use defaults
    const defaultCriteria = [
      {
        id: "innovation",
        name: "Innovation & Creativity",
        description: "Originality of the solution and creative approach to the problem",
        maxScore: 10,
        weight: 25,
      },
      {
        id: "feasibility",
        name: "Technical Feasibility",
        description: "Technical viability and practical implementation potential",
        maxScore: 10,
        weight: 25,
      },
      {
        id: "presentation",
        name: "Presentation Quality",
        description: "Clarity, organization, and quality of the submission materials",
        maxScore: 10,
        weight: 25,
      },
      {
        id: "impact",
        name: "Potential Impact",
        description: "Potential positive impact and scalability of the solution",
        maxScore: 10,
        weight: 25,
      },
    ];

    return {
      criteria: (stage as any).evaluationCriteria || defaultCriteria,
    };
  }


  private async saveEvaluationResults(
    teamId: string,
    stageId: string,
    cohortId: string,
    aiResult?: any,
    metrics?: any,
  ): Promise<void> {
    // Find or create evaluation record
    let evaluation = await this.evaluationRepo.findOne({
      where: { teamId, stageId },
    });

    if (!evaluation) {
      evaluation = this.evaluationRepo.create({
        teamId,
        stageId,
        cohortId,
      });
    }

    if (aiResult) {
      evaluation.aiScores = aiResult.scores;
      evaluation.aiOverallScore = aiResult.overallScore;
      evaluation.aiFeedback = aiResult.feedback;
      evaluation.aiStrengths = aiResult.strengths;
      evaluation.aiImprovements = aiResult.improvements;
      evaluation.aiEvaluatedAt = new Date();
    }

    if (metrics) {
      evaluation.metrics = metrics;
    }

    // Calculate final score if we have AI scores
    if (evaluation.aiOverallScore != null) {
      const calculatedScore = evaluation.calculateFinalScore();
      evaluation.finalScore = calculatedScore ?? undefined;
    }

    await this.evaluationRepo.save(evaluation);
  }

  private async updateJobStatus(
    jobId: string,
    updates: Partial<EvaluationJob>,
  ): Promise<void> {
    await this.evaluationJobRepo.update(jobId, updates);
  }

  private async updateJobProgress(
    jobId: string,
    progress: number,
    currentStep: string,
  ): Promise<void> {
    await this.evaluationJobRepo.update(jobId, { progress, currentStep });
  }
}
