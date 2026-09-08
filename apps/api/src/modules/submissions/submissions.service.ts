import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Stage,
  Submission,
  SubmissionHistory,
  SubmissionStatus,
  StageRequirements,
} from "@/database/entities/stage.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import {
  CreateStageDto,
  UpdateStageDto,
  SaveSubmissionDraftDto,
  SubmitSubmissionDto,
  EvaluateSubmissionDto,
  StageQueryDto,
  SubmissionQueryDto,
} from "./dto/submission.dto";

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Stage)
    private stageRepository: Repository<Stage>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(SubmissionHistory)
    private historyRepository: Repository<SubmissionHistory>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  // ============ Stage Operations ============

  async createStage(dto: CreateStageDto): Promise<Stage> {
    const stage = this.stageRepository.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      deadline: new Date(dto.deadline),
    });
    return this.stageRepository.save(stage);
  }

  async updateStage(id: string, dto: UpdateStageDto): Promise<Stage> {
    const stage = await this.stageRepository.findOne({ where: { id } });
    if (!stage) {
      throw new NotFoundException("Stage not found");
    }

    Object.assign(stage, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : stage.startDate,
      deadline: dto.deadline ? new Date(dto.deadline) : stage.deadline,
    });

    return this.stageRepository.save(stage);
  }

  async deleteStage(id: string): Promise<void> {
    const stage = await this.stageRepository.findOne({ where: { id } });
    if (!stage) {
      throw new NotFoundException("Stage not found");
    }

    // Check for submissions
    const submissionCount = await this.submissionRepository.count({
      where: { stageId: id },
    });
    if (submissionCount > 0) {
      throw new BadRequestException("Cannot delete stage with existing submissions");
    }

    await this.stageRepository.remove(stage);
  }

  async getStage(id: string): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: ["cohort"],
    });
    if (!stage) {
      throw new NotFoundException("Stage not found");
    }
    return stage;
  }

  async getStages(query: StageQueryDto): Promise<Stage[]> {
    const qb = this.stageRepository.createQueryBuilder("stage");

    if (query.cohortId) {
      qb.andWhere("stage.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    if (query.activeOnly) {
      qb.andWhere("stage.is_active = true");
    }

    qb.orderBy("stage.sort_order", "ASC").addOrderBy("stage.number", "ASC");

    return qb.getMany();
  }

  async getStagesWithStats(cohortId: string): Promise<Array<Stage & { stats: any }>> {
    const stages = await this.getStages({ cohortId, activeOnly: false });

    const stagesWithStats: Array<Stage & { stats: any }> = await Promise.all(
      stages.map(async (stage) => {
        const stats = await this.submissionRepository
          .createQueryBuilder("s")
          .select("s.status", "status")
          .addSelect("COUNT(*)", "count")
          .where("s.stage_id = :stageId", { stageId: stage.id })
          .groupBy("s.status")
          .getRawMany();

        const statusCounts = stats.reduce(
          (acc, { status, count }) => {
            acc[status] = parseInt(count, 10);
            return acc;
          },
          { draft: 0, submitted: 0, late: 0, evaluated: 0 },
        );

        return {
          ...stage,
          stats: {
            ...statusCounts,
            total: Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0),
          },
        } as Stage & { stats: any };
      }),
    );

    return stagesWithStats;
  }

  // ============ Submission Operations ============

  async getTeamForParticipant(participantId: string): Promise<Team | null> {
    const membership = await this.teamMemberRepository.findOne({
      where: { participantId },
      relations: ["team"],
    });
    return membership?.team || null;
  }

  async saveDraft(
    participantId: string,
    dto: SaveSubmissionDraftDto,
  ): Promise<Submission> {
    const team = await this.getTeamForParticipant(participantId);
    if (!team) {
      throw new ForbiddenException("You must be part of a team to submit");
    }

    const stage = await this.getStage(dto.stageId);
    if (!stage.isOpen()) {
      throw new BadRequestException("Stage is not open for submissions");
    }

    let submission = await this.submissionRepository.findOne({
      where: { teamId: team.id, stageId: dto.stageId },
    });

    if (submission) {
      // Cannot edit after submission
      if (submission.status !== SubmissionStatus.DRAFT) {
        throw new BadRequestException("Cannot edit a submitted submission");
      }

      // Save history before update
      await this.saveHistory(submission, participantId);

      // Update existing draft
      submission.content = dto.content || submission.content;
      submission.fileUrls = dto.fileUrls || submission.fileUrls;
      submission.githubUrl = dto.githubUrl ?? submission.githubUrl;
      submission.videoUrl = dto.videoUrl ?? submission.videoUrl;
      submission.version += 1;
      submission.lastSavedAt = new Date();
    } else {
      // Create new draft
      submission = this.submissionRepository.create({
        teamId: team.id,
        stageId: dto.stageId,
        status: SubmissionStatus.DRAFT,
        content: dto.content || {},
        fileUrls: dto.fileUrls || [],
        githubUrl: dto.githubUrl,
        videoUrl: dto.videoUrl,
        lastSavedAt: new Date(),
      });
    }

    return this.submissionRepository.save(submission);
  }

  async submit(
    participantId: string,
    dto: SubmitSubmissionDto,
  ): Promise<Submission> {
    const team = await this.getTeamForParticipant(participantId);
    if (!team) {
      throw new ForbiddenException("You must be part of a team to submit");
    }

    const stage = await this.getStage(dto.stageId);
    
    // Check if stage allows submissions
    const now = new Date();
    const isPastDeadline = now > stage.deadline;
    
    if (isPastDeadline && !stage.allowLateSubmissions) {
      throw new BadRequestException("Deadline has passed and late submissions are not allowed");
    }

    let submission = await this.submissionRepository.findOne({
      where: { teamId: team.id, stageId: dto.stageId },
    });

    if (submission && submission.status !== SubmissionStatus.DRAFT) {
      throw new BadRequestException("Submission has already been submitted");
    }

    // Validate required fields
    const content = dto.content || submission?.content || {};
    const fileUrls = dto.fileUrls || submission?.fileUrls || [];
    const githubUrl = dto.githubUrl ?? submission?.githubUrl;
    const videoUrl = dto.videoUrl ?? submission?.videoUrl;

    this.validateRequirements(stage.requirements, {
      content,
      fileUrls,
      githubUrl,
      videoUrl,
    });

    // Calculate late minutes
    let isLate = false;
    let lateMinutes = 0;
    if (isPastDeadline) {
      isLate = true;
      lateMinutes = Math.ceil((now.getTime() - stage.deadline.getTime()) / 60000);
    }

    if (submission) {
      // Save history
      await this.saveHistory(submission, participantId);

      submission.content = content;
      submission.fileUrls = fileUrls;
      submission.githubUrl = githubUrl;
      submission.videoUrl = videoUrl;
      submission.status = isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
      submission.submittedAt = now;
      submission.submittedBy = participantId;
      submission.isLate = isLate;
      submission.lateMinutes = lateMinutes;
      submission.version += 1;
    } else {
      submission = this.submissionRepository.create({
        teamId: team.id,
        stageId: dto.stageId,
        status: isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
        content,
        fileUrls,
        githubUrl,
        videoUrl,
        submittedAt: now,
        submittedBy: participantId,
        isLate,
        lateMinutes,
      });
    }

    return this.submissionRepository.save(submission);
  }

  private validateRequirements(
    requirements: StageRequirements,
    data: {
      content: Record<string, any>;
      fileUrls: any[];
      githubUrl?: string;
      videoUrl?: string;
    },
  ): void {
    const errors: string[] = [];

    if (requirements.documentRequired && data.fileUrls.length === 0) {
      errors.push("Document upload is required");
    }

    if (requirements.githubRequired && !data.githubUrl) {
      errors.push("GitHub URL is required");
    }

    if (requirements.videoRequired && !data.videoUrl) {
      errors.push("Video URL is required");
    }

    if (requirements.additionalFields) {
      for (const field of requirements.additionalFields) {
        if (field.required && !data.content[field.name]) {
          errors.push(`${field.label} is required`);
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join(", "));
    }
  }

  private async saveHistory(
    submission: Submission,
    savedBy: string,
  ): Promise<void> {
    const history = this.historyRepository.create({
      submissionId: submission.id,
      version: submission.version,
      content: submission.content,
      fileUrls: submission.fileUrls,
      githubUrl: submission.githubUrl,
      videoUrl: submission.videoUrl,
      savedBy,
    });
    await this.historyRepository.save(history);
  }

  async getSubmission(id: string): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ["stage", "team"],
    });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }
    return submission;
  }

  async getTeamSubmissions(participantId: string): Promise<Submission[]> {
    const team = await this.getTeamForParticipant(participantId);
    if (!team) {
      return [];
    }

    return this.submissionRepository.find({
      where: { teamId: team.id },
      relations: ["stage"],
      order: { createdAt: "DESC" },
    });
  }

  async getTeamSubmissionForStage(
    participantId: string,
    stageId: string,
  ): Promise<Submission | null> {
    const team = await this.getTeamForParticipant(participantId);
    if (!team) {
      return null;
    }

    return this.submissionRepository.findOne({
      where: { teamId: team.id, stageId },
      relations: ["stage"],
    });
  }

  async getSubmissions(query: SubmissionQueryDto): Promise<{
    submissions: Submission[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.submissionRepository
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.stage", "stage")
      .leftJoinAndSelect("submission.team", "team");

    if (query.stageId) {
      qb.andWhere("submission.stage_id = :stageId", { stageId: query.stageId });
    }

    if (query.teamId) {
      qb.andWhere("submission.team_id = :teamId", { teamId: query.teamId });
    }

    if (query.status) {
      qb.andWhere("submission.status = :status", { status: query.status });
    }

    qb.orderBy("submission.submitted_at", "DESC", "NULLS LAST")
      .addOrderBy("submission.created_at", "DESC");

    const [submissions, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { submissions, total, page, limit };
  }

  // ============ Evaluation Operations ============

  async evaluateSubmission(
    id: string,
    evaluatorId: string,
    dto: EvaluateSubmissionDto,
  ): Promise<Submission> {
    const submission = await this.getSubmission(id);

    if (submission.status === SubmissionStatus.DRAFT) {
      throw new BadRequestException("Cannot evaluate a draft submission");
    }

    submission.score = dto.score;
    submission.evaluationNotes = dto.evaluationNotes;
    submission.feedback = dto.feedback;
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = evaluatorId;
    submission.status = SubmissionStatus.EVALUATED;

    return this.submissionRepository.save(submission);
  }

  async getSubmissionHistory(submissionId: string): Promise<SubmissionHistory[]> {
    return this.historyRepository.find({
      where: { submissionId },
      order: { version: "DESC" },
    });
  }

  // ============ Stats ============

  async getSubmissionStats(cohortId: string): Promise<any[]> {
    const stages = await this.getStages({ cohortId });

    return Promise.all(
      stages.map(async (stage) => {
        const stats = await this.submissionRepository
          .createQueryBuilder("s")
          .select("s.status", "status")
          .addSelect("COUNT(*)", "count")
          .where("s.stage_id = :stageId", { stageId: stage.id })
          .groupBy("s.status")
          .getRawMany();

        const statusCounts = stats.reduce(
          (acc, { status, count }) => {
            acc[status] = parseInt(count, 10);
            return acc;
          },
          { draft: 0, submitted: 0, late: 0, evaluated: 0 },
        );

        // Get total teams in cohort for pending calculation
        const totalTeams = await this.teamRepository.count({
          where: { cohortId },
        });

        const submitted = statusCounts.submitted + statusCounts.late + statusCounts.evaluated;

        return {
          stageId: stage.id,
          stageName: stage.name,
          stageNumber: stage.number,
          deadline: stage.deadline,
          total: totalTeams,
          ...statusCounts,
          pending: totalTeams - submitted - statusCounts.draft,
        };
      }),
    );
  }
}
