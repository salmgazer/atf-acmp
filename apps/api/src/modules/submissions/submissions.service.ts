import { Transactional } from "@/common/decorators/transactional.decorator";
import { scoreAgainstRubric } from "@/common/services/rubric-scoring";
import { UploadService } from "@/common/services/upload.service";
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
import { User, Role } from "@/database/entities/user.entity";
import { NotificationTriggersService } from "@/modules/notifications/notification-triggers.service";
import {
  CreateStageDto,
  UpdateStageDto,
  SaveSubmissionDraftDto,
  SubmitSubmissionDto,
  EvaluateSubmissionDto,
  StageQueryDto,
  SubmissionQueryDto,
  ApproveSubmissionDto,
  RejectSubmissionDto,
  SubmissionApprovalQueryDto,
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
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationTriggers: NotificationTriggersService,
    private uploads: UploadService,
  ) {}

  // ============ Stage Operations ============

  async createStage(dto: CreateStageDto): Promise<Stage> {
    if (dto.evaluationCriteria) scoreAgainstRubric(dto.evaluationCriteria, dto.evaluationCriteria.map(item => ({ criterionId: item.id, score: 0 })));
    const stage = this.stageRepository.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      deadline: new Date(dto.deadline),
    });
    return this.stageRepository.save(stage);
  }

  async updateStage(id: string, dto: UpdateStageDto): Promise<Stage> {
    if (dto.evaluationCriteria) scoreAgainstRubric(dto.evaluationCriteria, dto.evaluationCriteria.map(item => ({ criterionId: item.id, score: 0 })));
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
          { draft: 0, submitted: 0, late: 0, pending_approval: 0, approved: 0, rejected: 0, evaluated: 0 },
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
    if (!participantId) throw new ForbiddenException("Participant authentication is required");
    const membership = await this.teamMemberRepository.findOne({
      where: { participantId, status: "confirmed" as any },
      relations: ["team"],
    });
    return membership?.team || null;
  }

  @Transactional()
  async saveDraft(
    participantId: string,
    dto: SaveSubmissionDraftDto,
  ): Promise<Submission> {
    const team = await this.getTeamForParticipant(participantId);
    if (!team) {
      throw new ForbiddenException("You must be part of a team to submit");
    }

    const stage = await this.getStage(dto.stageId);
    
    // Check existing submission to see if it's rejected (allows editing)
    const existingSubmission = await this.submissionRepository.findOne({
      where: { teamId: team.id, stageId: dto.stageId },
    });
    const isRejectedSubmission = existingSubmission?.status === SubmissionStatus.REJECTED;
    this.assertSubmissionAllowed(team, stage, isRejectedSubmission);
    if (dto.fileUrls) dto.fileUrls = await this.uploads.validateSubmissionDocuments(dto.fileUrls, team.id, stage.requirements.documentMaxSize, stage.requirements.documentTypes);
    if (dto.videoUrl) await this.uploads.validateSubmissionVideo(dto.videoUrl, team.id, stage.requirements.videoMaxSize, stage.requirements.videoMaxDuration);
    
    // Allow editing if stage is open OR if submission was rejected (for resubmission)
    if (!stage.isOpen() && !isRejectedSubmission) {
      throw new BadRequestException("Stage is not open for submissions");
    }

    let submission = existingSubmission;

    if (submission) {
      // Cannot edit after submission, except for rejected submissions (allow resubmission)
      if (submission.status !== SubmissionStatus.DRAFT && submission.status !== SubmissionStatus.REJECTED) {
        throw new BadRequestException("Cannot edit a submitted submission");
      }

      // Save history before update
      await this.saveHistory(submission, participantId);

      // Update existing draft (or rejected submission being revised)
      submission.content = dto.content || submission.content;
      submission.fileUrls = dto.fileUrls || submission.fileUrls;
      submission.videoUrl = dto.videoUrl ?? submission.videoUrl;
      submission.version += 1;
      submission.lastSavedAt = new Date();
      // If it was rejected, keep it as rejected until they resubmit
    } else {
      // Create new draft
      submission = this.submissionRepository.create({
        teamId: team.id,
        stageId: dto.stageId,
        status: SubmissionStatus.DRAFT,
        content: dto.content || {},
        fileUrls: dto.fileUrls || [],
        videoUrl: dto.videoUrl,
        lastSavedAt: new Date(),
      });
    }

    return this.submissionRepository.save(submission);
  }

  @Transactional()
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
    
    let submission = await this.submissionRepository.findOne({
      where: { teamId: team.id, stageId: dto.stageId },
    });

    // Allow resubmission for rejected submissions even past deadline
    const isResubmission = submission?.status === SubmissionStatus.REJECTED;
    this.assertSubmissionAllowed(team, stage, isResubmission);
    
    if (isPastDeadline && !stage.allowLateSubmissions && !isResubmission) {
      throw new BadRequestException("Deadline has passed and late submissions are not allowed");
    }

    if (submission && submission.status !== SubmissionStatus.DRAFT && submission.status !== SubmissionStatus.REJECTED) {
      throw new BadRequestException("Submission has already been submitted");
    }

    // Validate required fields
    const content = dto.content || submission?.content || {};
    const fileUrls = await this.uploads.validateSubmissionDocuments(dto.fileUrls || submission?.fileUrls || [], team.id, stage.requirements.documentMaxSize, stage.requirements.documentTypes);
    const videoUrl = dto.videoUrl ?? submission?.videoUrl;
    await this.uploads.validateSubmissionVideo(videoUrl, team.id, stage.requirements.videoMaxSize, stage.requirements.videoMaxDuration);

    // For GitHub requirement, check team's githubRepoUrl
    this.validateRequirements(stage.requirements, {
      content,
      fileUrls,
      githubRepoUrl: team.githubRepoUrl,
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
      submission.videoUrl = videoUrl;
      // If stage requires manual approval, set to pending_approval instead of submitted/late
      if (stage.requiresManualApproval) {
        submission.status = SubmissionStatus.PENDING_APPROVAL;
      } else {
        submission.status = isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
      }
      submission.submittedAt = now;
      submission.submittedBy = participantId;
      submission.isLate = isLate;
      submission.lateMinutes = lateMinutes;
      submission.version += 1;
    } else {
      // Determine status based on whether stage requires manual approval
      let status: SubmissionStatus;
      if (stage.requiresManualApproval) {
        status = SubmissionStatus.PENDING_APPROVAL;
      } else {
        status = isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
      }

      submission = this.submissionRepository.create({
        teamId: team.id,
        stageId: dto.stageId,
        status,
        content,
        fileUrls,
        videoUrl,
        submittedAt: now,
        submittedBy: participantId,
        isLate,
        lateMinutes,
      });
    }

    const savedSubmission = await this.submissionRepository.save(submission);

    // If stage requires manual approval, notify staff
    if (stage.requiresManualApproval) {
      await this.notifyStaffOfPendingApproval(savedSubmission, team, stage);
    }

    return savedSubmission;
  }

  private assertSubmissionAllowed(team: Team, stage: Stage, resubmission: boolean): void {
    if (team.cohortId !== stage.cohortId) throw new ForbiddenException("Stage and team must belong to the same cohort");
    if (team.status === "disqualified") throw new ForbiddenException("Disqualified teams cannot submit");
    if (!stage.isActive || (stage.startDate && stage.startDate > new Date())) throw new BadRequestException("Stage is not open for submissions");
    if (!resubmission && !stage.isOpen()) throw new BadRequestException("Stage is not open for submissions");
  }

  private validateRequirements(
    requirements: StageRequirements,
    data: {
      content: Record<string, any>;
      fileUrls: any[];
      githubRepoUrl?: string;
      videoUrl?: string;
    },
  ): void {
    const errors: string[] = [];
    const text = String(data.content?.textContent || "").trim();
    if (requirements.textRequired && !text) errors.push("Text content is required");
    if (requirements.textMinLength && text.length < requirements.textMinLength) errors.push("Text content is too short");
    if (requirements.textMaxLength && text.length > requirements.textMaxLength) errors.push("Text content is too long");
    if (requirements.urlRequired) {
      try {
        const url = new URL(String(data.content?.customUrl || ""));
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch { errors.push("A valid HTTP(S) URL is required"); }
    }
    for (const file of data.fileUrls) {
      if (requirements.documentMaxSize && (!Number.isFinite(file.size) || file.size > requirements.documentMaxSize * 1024 * 1024)) errors.push("Document exceeds the allowed size");
      const extension = String(file.name || "").split(".").pop()?.toLowerCase();
      if (requirements.documentTypes?.length && !requirements.documentTypes.includes(extension || "")) errors.push("Document type is not allowed");
    }

    // Minimum validation: must have at least one file OR some content
    const hasFiles = data.fileUrls && data.fileUrls.length > 0;
    const hasContent = data.content && Object.keys(data.content).some(key => {
      const value = data.content[key];
      return value !== null && value !== undefined && value !== '';
    });
    const hasGithub = !!data.githubRepoUrl;
    const hasVideo = !!data.videoUrl;

    if (!hasFiles && !hasContent && !hasGithub && !hasVideo) {
      errors.push("Submission must include at least one file, content, GitHub URL, or video URL");
    }

    // Stage-specific requirements
    if (requirements.documentRequired && data.fileUrls.length === 0) {
      errors.push("Document upload is required");
    }

    if (requirements.githubRequired && !data.githubRepoUrl) {
      errors.push("Team must have a GitHub repository URL set");
    }

    if (requirements.videoRequired && !data.videoUrl) {
      errors.push("Video URL is required");
    }

    if (requirements.additionalFields) {
      for (const field of requirements.additionalFields) {
        if (field.type === "url" && data.content[field.name]) {
          try { if (!["http:", "https:"].includes(new URL(data.content[field.name]).protocol)) throw new Error(); } catch { errors.push(`${field.label} must be an HTTP(S) URL`); }
        }
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

  @Transactional()
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

  // ============ Approval Operations ============

  async getPendingApprovalSubmissions(query: SubmissionApprovalQueryDto): Promise<{
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
      .leftJoinAndSelect("submission.team", "team")
      .where("stage.requiresManualApproval = true");

    if (query.stageId) {
      qb.andWhere("submission.stageId = :stageId", { stageId: query.stageId });
    }

    if (query.cohortId) {
      qb.andWhere("stage.cohortId = :cohortId", { cohortId: query.cohortId });
    }

    if (query.status) {
      qb.andWhere("submission.status = :status", { status: query.status });
    }
    // When no status is provided, show all submissions for stages requiring manual approval
    // (no default filter to pending_approval - let the frontend control this)

    qb.orderBy("submission.submittedAt", "ASC"); // Oldest first for FIFO processing

    const [submissions, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { submissions, total, page, limit };
  }

  @Transactional()
  async approveSubmission(
    id: string,
    approverId: string,
    dto: ApproveSubmissionDto,
  ): Promise<Submission> {
    const submission = await this.getSubmission(id);

    // Allow approval for pending_approval status, or late submissions on stages that require approval
    const stage = await this.stageRepository.findOne({ where: { id: submission.stageId } });
    const canApprove = 
      submission.status === SubmissionStatus.PENDING_APPROVAL ||
      (submission.status === SubmissionStatus.LATE && stage?.requiresManualApproval);

    if (!canApprove) {
      throw new BadRequestException("Submission is not pending approval");
    }

    submission.status = SubmissionStatus.APPROVED;
    submission.approvedAt = new Date();
    submission.approvedBy = approverId;
    submission.approvalNotes = dto.approvalNotes;

    const savedSubmission = await this.submissionRepository.save(submission);

    // Notify team members
    await this.notifyTeamOfApprovalResult(savedSubmission, true, dto.approvalNotes);

    return savedSubmission;
  }

  @Transactional()
  async rejectSubmission(
    id: string,
    rejecterId: string,
    dto: RejectSubmissionDto,
  ): Promise<Submission> {
    const submission = await this.getSubmission(id);

    // Allow rejection for pending_approval status, or late submissions on stages that require approval
    const stage = await this.stageRepository.findOne({ where: { id: submission.stageId } });
    const canReject = 
      submission.status === SubmissionStatus.PENDING_APPROVAL ||
      (submission.status === SubmissionStatus.LATE && stage?.requiresManualApproval);

    if (!canReject) {
      throw new BadRequestException("Submission is not pending approval");
    }

    submission.status = SubmissionStatus.REJECTED;
    submission.rejectedAt = new Date();
    submission.rejectedBy = rejecterId;
    submission.rejectionReason = dto.rejectionReason;

    const savedSubmission = await this.submissionRepository.save(submission);

    // Notify team members
    await this.notifyTeamOfApprovalResult(savedSubmission, false, undefined, dto.rejectionReason);

    return savedSubmission;
  }

  // ============ Notification Helpers ============

  private async notifyStaffOfPendingApproval(
    submission: Submission,
    team: Team,
    stage: Stage,
  ): Promise<void> {
    try {
      // Get staff users (program managers and super admins)
      const staffUsers = await this.userRepository.find({
        where: [
          { role: Role.PROGRAM_MANAGER, isActive: true },
          { role: Role.SUPER_ADMIN, isActive: true },
        ],
        select: ["id"],
      });

      if (staffUsers.length === 0) return;

      // Get cohort name
      const stageWithCohort = await this.stageRepository.findOne({
        where: { id: stage.id },
        relations: ["cohort"],
      });

      await this.notificationTriggers.onSubmissionNeedsApproval({
        staffUserIds: staffUsers.map((u) => u.id),
        submissionId: submission.id,
        teamId: team.id,
        teamName: team.name,
        stageId: stage.id,
        stageName: stage.name,
        cohortName: stageWithCohort?.cohort?.name || "Unknown Cohort",
      });
    } catch (error) {
      // Log but don't fail the submission
      console.error("Failed to send approval notification:", error);
    }
  }

  private async notifyTeamOfApprovalResult(
    submission: Submission,
    approved: boolean,
    approvalNotes?: string,
    rejectionReason?: string,
  ): Promise<void> {
    try {
      // Get team members
      const teamMembers = await this.teamMemberRepository.find({
        where: { teamId: submission.teamId },
        select: ["participantId"],
      });

      if (teamMembers.length === 0) return;

      // Get stage name
      const stage = await this.stageRepository.findOne({
        where: { id: submission.stageId },
      });

      const participantIds = teamMembers.map((m) => m.participantId);

      if (approved) {
        await this.notificationTriggers.onSubmissionApproved({
          teamMemberIds: participantIds,
          teamId: submission.teamId,
          stageName: stage?.name || "Unknown Stage",
          approvalNotes,
        });
      } else {
        await this.notificationTriggers.onSubmissionRejected({
          teamMemberIds: participantIds,
          teamId: submission.teamId,
          stageName: stage?.name || "Unknown Stage",
          rejectionReason: rejectionReason || "No reason provided",
        });
      }
    } catch (error) {
      // Log but don't fail the operation
      console.error("Failed to send team notification:", error);
    }
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
          { draft: 0, submitted: 0, late: 0, pending_approval: 0, approved: 0, rejected: 0, evaluated: 0 },
        );

        // Get total teams in cohort for pending calculation
        const totalTeams = await this.teamRepository.count({
          where: { cohortId },
        });

        const submitted = statusCounts.submitted + statusCounts.late + statusCounts.pending_approval + statusCounts.approved + statusCounts.evaluated;

        return {
          stageId: stage.id,
          stageName: stage.name,
          stageNumber: stage.number,
          deadline: stage.deadline,
          requiresManualApproval: stage.requiresManualApproval,
          total: totalTeams,
          ...statusCounts,
          pending: totalTeams - submitted - statusCounts.draft - statusCounts.rejected,
        };
      }),
    );
  }
}
