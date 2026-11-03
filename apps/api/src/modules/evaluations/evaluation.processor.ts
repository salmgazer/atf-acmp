import { Transactional } from "@/common/decorators/transactional.decorator";
import { Not } from "typeorm";
import { DocumentExtractionService } from "./document-extraction.service";
import { DEFAULT_EVALUATION_CRITERIA } from "@/common/services/rubric-scoring";
import { SubmissionStatus } from "@/database/entities/stage.entity";
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
    private readonly documents: DocumentExtractionService,
  ) {
    super();
  }

  async process(job: Job<EvaluationJobData>): Promise<void> {
    const { teamId, stageId, cohortId, evaluationJobId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing evaluation job ${job.id} for team ${teamId}`);

    try {
      const state = await this.evaluationJobRepo.findOne({ where: { id: evaluationJobId } });
      if (!state || state.status === EvaluationJobStatus.CANCELLED) return;
      // Update job status to processing
      await this.updateJobStatus(evaluationJobId, {
        status: EvaluationJobStatus.PROCESSING,
        bullJobId: job.id,
        startedAt: new Date(),
        currentStep: EVALUATION_STEPS.FETCH_SUBMISSION,
        progress: 10,
      });

      // Step 1: Fetch team info (submission is optional for code-only evaluation)
      const team = await this.teamRepo.findOne({ where: { id: teamId } });
      const stage = await this.stageRepo.findOne({ where: { id: stageId } });

      if (!team || !stage) {
        throw new Error("Team or stage not found");
      }

      if (team.cohortId !== stage.cohortId || cohortId !== team.cohortId || !stage.requiresAiEvaluation || !stage.isActive) throw new Error("Stage is not eligible for AI evaluation");
      if (!this.geminiService.isAvailable()) throw new Error("Gemini AI service is not configured");

      // Step 2: Fetch the submitted work
      const submission = await this.fetchSubmission(teamId, stageId);
      if (!submission || ![SubmissionStatus.SUBMITTED, SubmissionStatus.APPROVED, SubmissionStatus.LATE, SubmissionStatus.EVALUATED].includes(submission.status) || (stage.requiresManualApproval && ![SubmissionStatus.APPROVED, SubmissionStatus.EVALUATED].includes(submission.status))) throw new Error("No approved submission found for team and stage");
      await this.updateJobProgress(evaluationJobId, 20, EVALUATION_STEPS.FETCH_GITHUB);

      // Step 3: Analyze GitHub if available (use team's github repo URL)
      let codeAnalysis: CodeAnalysisData | undefined;
      if (team.githubRepoUrl) {
        await this.updateJobProgress(evaluationJobId, 30, EVALUATION_STEPS.ANALYZE_CODE);
        codeAnalysis = await this.analyzeGitHub(team.githubRepoUrl);
      }

      if (!codeAnalysis && !submission) {
        throw new Error("No GitHub repository or submission found for team");
      }

      await this.updateJobProgress(evaluationJobId, 50, EVALUATION_STEPS.ANALYZE_DOCUMENTS);

      // Step 4: Prepare submission data for AI
      const submissionData = this.prepareSubmissionData(submission, team, stage);
      if ((submission.fileUrls || []).length > 5) throw new Error("Evaluation supports at most five documents; no documents were omitted");
      submissionData.documents = await Promise.all((submission.fileUrls || []).map(file => this.documents.extract(file)));

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

      const currentState = await this.evaluationJobRepo.findOne({ where: { id: evaluationJobId } });
      if (currentState?.status === EvaluationJobStatus.CANCELLED) return;
      if (!aiResult) throw new Error("AI evaluation returned no result");

      const processingTime = Date.now() - startTime;
      await this.commitResults(evaluationJobId, teamId, stageId, cohortId, submission.id, aiResult, metrics, processingTime);

      this.logger.log(
        `Completed evaluation job ${job.id} in ${processingTime}ms`,
      );
    } catch (error: any) {
      this.logger.error(`Failed evaluation job ${job.id}: ${error.message}`);

      await this.updateJobStatus(evaluationJobId, {
        status: job.attemptsMade + 1 < (job.opts?.attempts || 1) ? EvaluationJobStatus.PENDING : EvaluationJobStatus.FAILED,
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
      const parsed = this.githubService.parseGitHubUrl(githubUrl);
      if (!parsed) {
        this.logger.warn(`Invalid GitHub URL: ${githubUrl}`);
        return undefined;
      }

      const { owner, repo } = parsed;
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
        totalLines: 0, // Unknown; do not infer a measured line count.
        sampleCode: await this.githubService.getSourceSamples(owner, repoName, structure || []),
        commits: commits.map((c: any) => ({
          message: c.message || c.commit?.message || "",
          date: c.author?.date || c.commit?.author?.date || "",
          author: c.author?.name || c.commit?.author?.name || c.author?.login || "Unknown",
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
    submission: Submission | null,
    team: Team,
    stage: Stage,
  ): SubmissionData {
    return {
      teamName: team.name,
      projectName: team.name, // Use team name as project name
      stageNumber: stage.number,
      stageName: stage.name,
      documents: submission?.fileUrls?.map((f: any) => ({
        name: f.name || "Document",
        content: f.extractedText || "[Document content not extracted]",
        type: f.type || "document",
      })),
      githubUrl: team.githubRepoUrl,
      videoUrl: submission?.videoUrl,
      additionalContent: submission?.content,
      evaluationPrompt: stage.evaluationPrompt,
    };
  }

  private buildRubricFromStage(stage: Stage): { criteria: any[] } {
    return { criteria: stage.evaluationCriteria?.length ? stage.evaluationCriteria : DEFAULT_EVALUATION_CRITERIA };
  }


  @Transactional("evaluation-result")
  private async commitResults(jobId: string, teamId: string, stageId: string, cohortId: string, submissionId: string, aiResult: any, metrics: any, processingTimeMs: number): Promise<void> {
    const state = await this.evaluationJobRepo.findOne({ where: { id: jobId } });
    if (!state || state.status === EvaluationJobStatus.CANCELLED) return;
    await this.saveEvaluationResults(teamId, stageId, cohortId, aiResult, metrics);
    await this.submissionRepo.update(submissionId, { status: SubmissionStatus.EVALUATED });
    await this.updateJobStatus(jobId, { status: EvaluationJobStatus.COMPLETED, completedAt: new Date(), progress: 100, currentStep: null as any, processingTimeMs });
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
    await this.evaluationJobRepo.update({ id: jobId, status: Not(EvaluationJobStatus.CANCELLED) }, updates);
  }

  private async updateJobProgress(
    jobId: string,
    progress: number,
    currentStep: string,
  ): Promise<void> {
    await this.evaluationJobRepo.update(jobId, { progress, currentStep });
  }
}
