import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Not, IsNull } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  Evaluation,
  EvaluationJob,
  EvaluationJobStatus,
} from "@/database/entities/evaluation.entity";
import { Submission, SubmissionStatus } from "@/database/entities/stage.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import {
  TriggerEvaluationDto,
  TriggerSingleEvaluationDto,
  EvaluationQueryDto,
  JobQueryDto,
  SubmitHumanScoreDto,
  QueueStatusResponse,
  EvaluationStatsResponse,
} from "./dto/evaluation.dto";
import {
  EVALUATION_QUEUE_NAME,
  EVALUATION_JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
} from "./evaluation.constants";
import { EvaluationJobData } from "./evaluation.processor";
import { OneSignalService } from "@/modules/notifications/onesignal.service";

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    @InjectRepository(Evaluation)
    private evaluationRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationJob)
    private evaluationJobRepo: Repository<EvaluationJob>,
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
    @InjectQueue(EVALUATION_QUEUE_NAME)
    private evaluationQueue: Queue<EvaluationJobData>,
    private oneSignalService: OneSignalService,
  ) {}

  // ============ Trigger Methods ============

  async triggerBatchEvaluation(dto: TriggerEvaluationDto): Promise<{
    queued: number;
    skipped: number;
    jobs: EvaluationJob[];
  }> {
    const { cohortId, stageId, teamIds } = dto;

    // CODE EVALUATION MODE: Get all teams with GitHub repos in this cohort
    let teams = await this.teamRepo.find({
      where: {
        cohortId,
        githubRepoUrl: Not(IsNull()),
      },
    });

    // Filter by specific team IDs if provided
    if (teamIds && teamIds.length > 0) {
      teams = teams.filter((t) => teamIds.includes(t.id));
    }

    // Filter out teams that already have completed evaluations for this stage
    const existingEvaluations = await this.evaluationRepo.find({
      where: { stageId },
      select: ["teamId", "aiEvaluatedAt"],
    });

    const evaluatedTeamIds = new Set(
      existingEvaluations
        .filter((e) => e.aiEvaluatedAt != null)
        .map((e) => e.teamId),
    );

    const toEvaluate = teams.filter(
      (t) => !evaluatedTeamIds.has(t.id),
    );

    const jobs: EvaluationJob[] = [];
    let skipped = 0;

    for (const team of toEvaluate) {
      // Check for existing pending/processing job
      const existingJob = await this.evaluationJobRepo.findOne({
        where: {
          teamId: team.id,
          stageId,
          status: In([EvaluationJobStatus.PENDING, EvaluationJobStatus.PROCESSING]),
        },
      });

      if (existingJob) {
        skipped++;
        continue;
      }

      // Create job record
      const evaluationJob = this.evaluationJobRepo.create({
        teamId: team.id,
        stageId,
        cohortId,
        status: EvaluationJobStatus.PENDING,
      });
      await this.evaluationJobRepo.save(evaluationJob);

      // Add to BullMQ queue
      await this.evaluationQueue.add(
        EVALUATION_JOB_TYPES.EVALUATE_SUBMISSION,
        {
          teamId: team.id,
          stageId,
          cohortId,
          evaluationJobId: evaluationJob.id,
        },
        DEFAULT_JOB_OPTIONS,
      );

      jobs.push(evaluationJob);
    }

    this.logger.log(
      `Queued ${jobs.length} evaluation jobs for stage ${stageId}, skipped ${skipped}`,
    );

    return {
      queued: jobs.length,
      skipped: skipped + (teams.length - toEvaluate.length),
      jobs,
    };
  }


  async triggerSingleEvaluation(dto: TriggerSingleEvaluationDto): Promise<EvaluationJob> {
    const { teamId, stageId } = dto;

    // Verify submission exists
    const submission = await this.submissionRepo.findOne({
      where: { teamId, stageId },
    });

    if (!submission) {
      throw new NotFoundException("No submission found for this team and stage");
    }

    if (submission.status === SubmissionStatus.DRAFT) {
      throw new BadRequestException("Cannot evaluate draft submissions");
    }

    // Check for existing pending/processing job
    const existingJob = await this.evaluationJobRepo.findOne({
      where: {
        teamId,
        stageId,
        status: In([EvaluationJobStatus.PENDING, EvaluationJobStatus.PROCESSING]),
      },
    });

    if (existingJob) {
      throw new BadRequestException("Evaluation already in progress for this team");
    }

    // Get team to find cohortId
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException("Team not found");
    }

    // Create job record
    const evaluationJob = this.evaluationJobRepo.create({
      teamId,
      stageId,
      cohortId: team.cohortId,
      status: EvaluationJobStatus.PENDING,
    });
    await this.evaluationJobRepo.save(evaluationJob);

    // Add to queue
    await this.evaluationQueue.add(
      EVALUATION_JOB_TYPES.EVALUATE_SUBMISSION,
      {
        teamId,
        stageId,
        cohortId: team.cohortId,
        evaluationJobId: evaluationJob.id,
      },
      DEFAULT_JOB_OPTIONS,
    );

    return evaluationJob;
  }

  async retryFailedJob(jobId: string): Promise<EvaluationJob> {
    const job = await this.evaluationJobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    if (!job.canRetry()) {
      throw new BadRequestException("Job cannot be retried");
    }

    // Reset job status
    job.status = EvaluationJobStatus.PENDING;
    job.error = undefined;
    job.errorStack = undefined;
    await this.evaluationJobRepo.save(job);

    // Re-add to queue
    await this.evaluationQueue.add(
      EVALUATION_JOB_TYPES.EVALUATE_SUBMISSION,
      {
        teamId: job.teamId,
        stageId: job.stageId,
        cohortId: job.cohortId,
        evaluationJobId: job.id,
      },
      DEFAULT_JOB_OPTIONS,
    );

    return job;
  }

  async cancelJob(jobId: string): Promise<EvaluationJob> {
    const job = await this.evaluationJobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    if (job.status === EvaluationJobStatus.COMPLETED) {
      throw new BadRequestException("Cannot cancel completed job");
    }

    // Try to remove from BullMQ queue
    if (job.bullJobId) {
      const bullJob = await this.evaluationQueue.getJob(job.bullJobId);
      if (bullJob) {
        await bullJob.remove();
      }
    }

    job.status = EvaluationJobStatus.CANCELLED;
    return this.evaluationJobRepo.save(job);
  }


  // ============ Query Methods ============

  async getEvaluations(query: EvaluationQueryDto): Promise<{
    data: Evaluation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { cohortId, stageId, teamId, needsHumanReview, isPublished, page = 1, limit = 20 } = query;

    const qb = this.evaluationRepo
      .createQueryBuilder("evaluation")
      .leftJoinAndSelect("evaluation.team", "team")
      .leftJoinAndSelect("evaluation.stage", "stage");

    if (cohortId) {
      qb.andWhere("evaluation.cohortId = :cohortId", { cohortId });
    }

    if (stageId) {
      qb.andWhere("evaluation.stageId = :stageId", { stageId });
    }

    if (teamId) {
      qb.andWhere("evaluation.teamId = :teamId", { teamId });
    }

    if (needsHumanReview === true) {
      qb.andWhere("evaluation.aiEvaluatedAt IS NOT NULL")
        .andWhere("evaluation.humanEvaluatedAt IS NULL");
    }

    if (isPublished !== undefined) {
      qb.andWhere("evaluation.isPublished = :isPublished", { isPublished });
    }

    qb.orderBy("evaluation.createdAt", "DESC");

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async getEvaluation(id: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id },
      relations: ["team", "stage"],
    });

    if (!evaluation) {
      throw new NotFoundException("Evaluation not found");
    }

    return evaluation;
  }

  async getEvaluationForTeam(teamId: string, stageId: string): Promise<Evaluation | null> {
    return this.evaluationRepo.findOne({
      where: { teamId, stageId },
      relations: ["stage"],
    });
  }

  async getJobs(query: JobQueryDto): Promise<{
    data: EvaluationJob[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { cohortId, stageId, status, page = 1, limit = 20 } = query;

    const qb = this.evaluationJobRepo
      .createQueryBuilder("job")
      .leftJoinAndSelect("job.team", "team")
      .leftJoinAndSelect("job.stage", "stage");

    if (cohortId) {
      qb.andWhere("job.cohortId = :cohortId", { cohortId });
    }

    if (stageId) {
      qb.andWhere("job.stageId = :stageId", { stageId });
    }

    if (status) {
      qb.andWhere("job.status = :status", { status });
    }

    qb.orderBy("job.createdAt", "DESC");

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async getJob(id: string): Promise<EvaluationJob> {
    const job = await this.evaluationJobRepo.findOne({
      where: { id },
      relations: ["team", "stage"],
    });

    if (!job) {
      throw new NotFoundException("Job not found");
    }

    return job;
  }


  // ============ Queue Status Methods ============

  async getQueueStatus(): Promise<QueueStatusResponse> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.evaluationQueue.getWaitingCount(),
      this.evaluationQueue.getActiveCount(),
      this.evaluationQueue.getCompletedCount(),
      this.evaluationQueue.getFailedCount(),
      this.evaluationQueue.getDelayedCount(),
    ]);

    const isPaused = await this.evaluationQueue.isPaused();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.evaluationQueue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.evaluationQueue.resume();
  }

  async clearQueue(): Promise<number> {
    await this.evaluationQueue.drain();
    return 0;
  }

  // ============ Stats Methods ============

  async getStageStats(cohortId: string, stageId: string): Promise<EvaluationStatsResponse> {
    const submissions = await this.submissionRepo.count({
      where: {
        stageId,
        status: In([SubmissionStatus.SUBMITTED, SubmissionStatus.LATE]),
      },
    });

    const evaluations = await this.evaluationRepo.find({
      where: { cohortId, stageId },
      select: ["id", "aiEvaluatedAt", "finalScore"],
    });

    const evaluated = evaluations.filter((e) => e.aiEvaluatedAt != null).length;

    const jobs = await this.evaluationJobRepo.find({
      where: { cohortId, stageId },
      select: ["status", "processingTimeMs"],
    });

    const failedJobs = jobs.filter((j) => j.status === EvaluationJobStatus.FAILED).length;

    const completedJobs = jobs.filter(
      (j) => j.status === EvaluationJobStatus.COMPLETED && j.processingTimeMs,
    );
    const avgProcessingTime =
      completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => sum + (j.processingTimeMs || 0), 0) / completedJobs.length
        : 0;

    const scores = evaluations.filter((e) => e.finalScore != null).map((e) => Number(e.finalScore));
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      totalTeams: submissions,
      evaluated,
      pending: submissions - evaluated,
      failed: failedJobs,
      averageScore: Math.round(avgScore * 100) / 100,
      averageProcessingTime: Math.round(avgProcessingTime),
    };
  }

  // ============ Human Scoring Methods ============

  async submitHumanScore(
    evaluationId: string,
    dto: SubmitHumanScoreDto,
    evaluatorId: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new NotFoundException("Evaluation not found");
    }

    // Calculate weighted human score
    let totalScore = 0;
    let totalMaxScore = 0;
    for (const score of dto.scores) {
      totalScore += score.score;
      totalMaxScore += score.maxScore;
    }
    const humanOverallScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    evaluation.humanScores = dto.scores;
    evaluation.humanOverallScore = humanOverallScore;
    evaluation.humanFeedback = dto.feedback;
    evaluation.humanEvaluatedAt = new Date();
    evaluation.humanEvaluatorId = evaluatorId;

    // Recalculate final score
    const calculatedScore = evaluation.calculateFinalScore();
    evaluation.finalScore = calculatedScore ?? undefined;

    return this.evaluationRepo.save(evaluation);
  }

  async publishEvaluations(evaluationIds: string[]): Promise<number> {
    const result = await this.evaluationRepo.update(
      { id: In(evaluationIds) },
      { isPublished: true, publishedAt: new Date() },
    );

    // Send push notifications to team members
    await this.notifyTeamsOfPublishedEvaluations(evaluationIds);

    return result.affected || 0;
  }

  private async notifyTeamsOfPublishedEvaluations(evaluationIds: string[]): Promise<void> {
    try {
      // Get published evaluations with stage info
      const evaluations = await this.evaluationRepo.find({
        where: { id: In(evaluationIds) },
        relations: ["stage"],
      });

      // Group by team to avoid duplicate notifications
      const teamIds = [...new Set(evaluations.map((e) => e.teamId))];
      
      if (teamIds.length === 0) return;

      // Get team members for all teams
      const teamMembers = await this.teamMemberRepo.find({
        where: { teamId: In(teamIds) },
      });

      // Group members by team
      const membersByTeam = new Map<string, string[]>();
      for (const member of teamMembers) {
        if (!membersByTeam.has(member.teamId)) {
          membersByTeam.set(member.teamId, []);
        }
        membersByTeam.get(member.teamId)!.push(`participant:${member.participantId}`);
      }

      // Send notification to each team's members
      for (const evaluation of evaluations) {
        const participantIds = membersByTeam.get(evaluation.teamId) || [];
        if (participantIds.length === 0) continue;

        const stageName = evaluation.stage?.name || "Stage";

        this.logger.log(
          `[PUSH] Sending evaluation published notification to ${participantIds.length} members for team ${evaluation.teamId}`
        );

        await this.oneSignalService.sendToExternalUserIds(participantIds, {
          title: "📊 Evaluation Published",
          body: `Your submission for ${stageName} has been evaluated! Check your results.`,
          data: {
            type: "evaluation_published",
            evaluationId: evaluation.id,
            stageId: evaluation.stageId,
            stageName,
          },
          url: "/app/evaluations",
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send evaluation published notifications: ${error.message}`);
    }
  }

  async unpublishEvaluations(evaluationIds: string[]): Promise<number> {
    const result = await this.evaluationRepo.update(
      { id: In(evaluationIds) },
      { isPublished: false, publishedAt: undefined } as any,
    );
    return result.affected || 0;
  }

  async updateAIWeight(evaluationId: string, aiWeight: number): Promise<Evaluation> {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new NotFoundException("Evaluation not found");
    }

    evaluation.aiWeight = aiWeight;
    const calculatedScore = evaluation.calculateFinalScore();
    evaluation.finalScore = calculatedScore ?? undefined;

    return this.evaluationRepo.save(evaluation);
  }
}
