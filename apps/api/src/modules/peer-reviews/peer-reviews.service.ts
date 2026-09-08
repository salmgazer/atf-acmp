import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PeerReviewAssignment,
  PeerReviewAssignmentStatus,
  PeerReview,
  PeerReviewRubric,
} from "@/database/entities/peer-review.entity";
import { Team, TeamMember, TeamStatus } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import {
  CreateRubricDto,
  UpdateRubricDto,
  AssignPeerReviewsDto,
  SubmitPeerReviewDto,
  PeerReviewQueryDto,
} from "./dto/peer-review.dto";

@Injectable()
export class PeerReviewsService {
  constructor(
    @InjectRepository(PeerReviewAssignment)
    private assignmentRepo: Repository<PeerReviewAssignment>,
    @InjectRepository(PeerReview)
    private reviewRepo: Repository<PeerReview>,
    @InjectRepository(PeerReviewRubric)
    private rubricRepo: Repository<PeerReviewRubric>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(Participant)
    private participantRepo: Repository<Participant>,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
  ) {}

  // ============ Rubric Methods ============

  async createRubric(dto: CreateRubricDto): Promise<PeerReviewRubric> {
    // Validate criteria weights sum to 100
    const totalWeight = dto.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException("Criteria weights must sum to 100");
    }

    const rubric = this.rubricRepo.create(dto);
    return this.rubricRepo.save(rubric);
  }

  async updateRubric(id: string, dto: UpdateRubricDto): Promise<PeerReviewRubric> {
    const rubric = await this.rubricRepo.findOne({ where: { id } });
    if (!rubric) {
      throw new NotFoundException("Rubric not found");
    }

    if (dto.criteria) {
      const totalWeight = dto.criteria.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight !== 100) {
        throw new BadRequestException("Criteria weights must sum to 100");
      }
    }

    Object.assign(rubric, dto);
    return this.rubricRepo.save(rubric);
  }

  async getRubric(id: string): Promise<PeerReviewRubric> {
    const rubric = await this.rubricRepo.findOne({ where: { id } });
    if (!rubric) {
      throw new NotFoundException("Rubric not found");
    }
    return rubric;
  }

  async getRubricForStage(cohortId: string, stageId: string): Promise<PeerReviewRubric | null> {
    // First try stage-specific rubric, then fall back to cohort default
    let rubric = await this.rubricRepo.findOne({
      where: { cohortId, stageId, isActive: true },
    });

    if (!rubric) {
      rubric = await this.rubricRepo.findOne({
        where: { cohortId, stageId: undefined, isActive: true },
      });
    }

    return rubric;
  }

  async getRubrics(cohortId: string): Promise<PeerReviewRubric[]> {
    return this.rubricRepo.find({
      where: { cohortId },
      order: { createdAt: "DESC" },
    });
  }

  async deleteRubric(id: string): Promise<void> {
    const result = await this.rubricRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException("Rubric not found");
    }
  }

  // ============ Assignment Methods ============

  /**
   * Assign peer reviews for a stage using balanced random assignment
   * Algorithm: Each team reviews N other teams, no self-review, balanced distribution
   */
  async assignPeerReviews(dto: AssignPeerReviewsDto): Promise<PeerReviewAssignment[]> {
    const { cohortId, stageId, reviewsPerTeam, dueDate } = dto;

    // Get all active teams in the cohort
    const teams = await this.teamRepo.find({
      where: { cohortId, status: TeamStatus.ACTIVE },
      select: ["id"],
    });

    if (teams.length < 2) {
      throw new BadRequestException("Need at least 2 teams for peer review");
    }

    if (reviewsPerTeam >= teams.length) {
      throw new BadRequestException(
        `Cannot assign ${reviewsPerTeam} reviews per team with only ${teams.length} teams`,
      );
    }

    // Check for existing assignments
    const existingCount = await this.assignmentRepo.count({
      where: { cohortId, stageId },
    });

    if (existingCount > 0) {
      throw new BadRequestException("Peer review assignments already exist for this stage");
    }

    // Build balanced assignment using round-robin approach
    const assignments: Partial<PeerReviewAssignment>[] = [];
    const teamIds = teams.map((t) => t.id);
    const reviewCount: Map<string, number> = new Map();

    // Initialize review counts
    teamIds.forEach((id) => reviewCount.set(id, 0));

    // For each team, assign N teams to review
    for (const reviewerTeamId of teamIds) {
      // Get potential teams to review (exclude self)
      const potentialTargets = teamIds
        .filter((id) => id !== reviewerTeamId)
        .map((id) => ({ id, count: reviewCount.get(id) || 0 }))
        .sort((a, b) => a.count - b.count); // Prioritize least-reviewed teams

      // Take the N least-reviewed teams
      const targetsToReview = potentialTargets.slice(0, reviewsPerTeam);

      for (const target of targetsToReview) {
        assignments.push({
          cohortId,
          stageId,
          reviewerTeamId,
          reviewedTeamId: target.id,
          status: PeerReviewAssignmentStatus.PENDING,
          dueDate: new Date(dueDate),
        });
        reviewCount.set(target.id, (reviewCount.get(target.id) || 0) + 1);
      }
    }

    // Bulk insert assignments
    const created = this.assignmentRepo.create(assignments);
    return this.assignmentRepo.save(created);
  }

  async getMyAssignedReviews(participantId: string): Promise<PeerReviewAssignment[]> {
    // Get participant's team through TeamMember
    const teamMember = await this.teamMemberRepo.findOne({
      where: { participantId },
      select: ["teamId"],
    });

    if (!teamMember?.teamId) {
      return [];
    }

    return this.assignmentRepo.find({
      where: { reviewerTeamId: teamMember.teamId },
      relations: ["reviewedTeam", "stage"],
      order: { dueDate: "ASC" },
    });
  }

  async getMyReceivedReviews(participantId: string): Promise<PeerReview[]> {
    // Get participant's team through TeamMember
    const teamMember = await this.teamMemberRepo.findOne({
      where: { participantId },
      select: ["teamId"],
    });

    if (!teamMember?.teamId) {
      return [];
    }

    // Get all assignments where this team was reviewed
    const assignments = await this.assignmentRepo.find({
      where: { reviewedTeamId: teamMember.teamId, status: PeerReviewAssignmentStatus.COMPLETED },
      select: ["id"],
    });

    if (assignments.length === 0) {
      return [];
    }

    const assignmentIds = assignments.map((a) => a.id);

    return this.reviewRepo
      .createQueryBuilder("review")
      .leftJoinAndSelect("review.assignment", "assignment")
      .leftJoinAndSelect("assignment.stage", "stage")
      .where("review.assignmentId IN (:...assignmentIds)", { assignmentIds })
      .orderBy("review.submittedAt", "DESC")
      .getMany();
  }

  async getAssignment(id: string): Promise<PeerReviewAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ["reviewedTeam", "reviewerTeam", "stage"],
    });

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    return assignment;
  }

  // ============ Review Submission Methods ============

  async submitReview(participantId: string, dto: SubmitPeerReviewDto): Promise<PeerReview> {
    const { assignmentId, scores, overallComment, strengths, improvements, isAnonymous, timeSpentMinutes } = dto;

    // Get assignment and verify access
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: ["reviewerTeam"],
    });

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    // Verify participant belongs to reviewer team through TeamMember
    const teamMember = await this.teamMemberRepo.findOne({
      where: { participantId },
      select: ["id", "teamId"],
    });

    if (!teamMember || teamMember.teamId !== assignment.reviewerTeamId) {
      throw new ForbiddenException("You are not authorized to submit this review");
    }

    // Check if already submitted
    const existing = await this.reviewRepo.findOne({
      where: { assignmentId },
    });

    if (existing) {
      throw new BadRequestException("Review already submitted for this assignment");
    }

    // Check if assignment is still open
    if (assignment.status === PeerReviewAssignmentStatus.COMPLETED) {
      throw new BadRequestException("This assignment is already completed");
    }

    if (assignment.status === PeerReviewAssignmentStatus.SKIPPED) {
      throw new BadRequestException("This assignment has been skipped");
    }

    // Calculate overall score (weighted average)
    const rubric = await this.getRubricForStage(assignment.cohortId, assignment.stageId);
    let overallScore = 0;

    if (rubric) {
      // Calculate weighted score
      for (const score of scores) {
        const criterion = rubric.criteria.find((c) => c.id === score.criterionId);
        if (criterion) {
          const normalizedScore = (score.score / score.maxScore) * 100;
          overallScore += normalizedScore * (criterion.weight / 100);
        }
      }
    } else {
      // Simple average if no rubric
      const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
      const maxTotal = scores.reduce((sum, s) => sum + s.maxScore, 0);
      overallScore = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;
    }

    // Create review
    const review = this.reviewRepo.create({
      assignmentId,
      reviewerParticipantId: participantId,
      scores,
      overallScore,
      overallComment,
      strengths,
      improvements,
      isAnonymous: isAnonymous ?? true,
      submittedAt: new Date(),
      timeSpentMinutes,
    });

    await this.reviewRepo.save(review);

    // Update assignment status
    assignment.status = PeerReviewAssignmentStatus.COMPLETED;
    assignment.completedAt = new Date();
    await this.assignmentRepo.save(assignment);

    return review;
  }

  async startReview(participantId: string, assignmentId: string): Promise<PeerReviewAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    // Verify participant belongs to reviewer team through TeamMember
    const teamMember = await this.teamMemberRepo.findOne({
      where: { participantId },
      select: ["teamId"],
    });

    if (!teamMember || teamMember.teamId !== assignment.reviewerTeamId) {
      throw new ForbiddenException("You are not authorized to access this assignment");
    }

    if (assignment.status === PeerReviewAssignmentStatus.PENDING) {
      assignment.status = PeerReviewAssignmentStatus.IN_PROGRESS;
      await this.assignmentRepo.save(assignment);
    }

    return assignment;
  }

  // ============ Admin Methods ============

  async getAssignments(query: PeerReviewQueryDto): Promise<{
    data: PeerReviewAssignment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { cohortId, stageId, reviewerTeamId, reviewedTeamId, status, page = 1, limit = 20 } = query;

    const qb = this.assignmentRepo
      .createQueryBuilder("assignment")
      .leftJoinAndSelect("assignment.reviewerTeam", "reviewerTeam")
      .leftJoinAndSelect("assignment.reviewedTeam", "reviewedTeam")
      .leftJoinAndSelect("assignment.stage", "stage");

    if (cohortId) {
      qb.andWhere("assignment.cohortId = :cohortId", { cohortId });
    }

    if (stageId) {
      qb.andWhere("assignment.stageId = :stageId", { stageId });
    }

    if (reviewerTeamId) {
      qb.andWhere("assignment.reviewerTeamId = :reviewerTeamId", { reviewerTeamId });
    }

    if (reviewedTeamId) {
      qb.andWhere("assignment.reviewedTeamId = :reviewedTeamId", { reviewedTeamId });
    }

    if (status) {
      qb.andWhere("assignment.status = :status", { status });
    }

    qb.orderBy("assignment.dueDate", "ASC");

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async getReviews(query: PeerReviewQueryDto): Promise<PeerReview[]> {
    const { cohortId, stageId } = query;

    const qb = this.reviewRepo
      .createQueryBuilder("review")
      .leftJoinAndSelect("review.assignment", "assignment")
      .leftJoinAndSelect("assignment.reviewerTeam", "reviewerTeam")
      .leftJoinAndSelect("assignment.reviewedTeam", "reviewedTeam");

    if (cohortId) {
      qb.andWhere("assignment.cohortId = :cohortId", { cohortId });
    }

    if (stageId) {
      qb.andWhere("assignment.stageId = :stageId", { stageId });
    }

    return qb.orderBy("review.submittedAt", "DESC").getMany();
  }

  async getReviewById(id: string): Promise<PeerReview> {
    const review = await this.reviewRepo.findOne({
      where: { id },
      relations: ["assignment", "assignment.reviewerTeam", "assignment.reviewedTeam", "reviewerParticipant"],
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    return review;
  }

  async flagReview(id: string, reason: string): Promise<PeerReview> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException("Review not found");
    }

    review.isFlagged = true;
    review.flagReason = reason;
    return this.reviewRepo.save(review);
  }

  async unflagReview(id: string): Promise<PeerReview> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException("Review not found");
    }

    review.isFlagged = false;
    review.flagReason = undefined;
    return this.reviewRepo.save(review);
  }

  async skipAssignment(id: string): Promise<PeerReviewAssignment> {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    assignment.status = PeerReviewAssignmentStatus.SKIPPED;
    return this.assignmentRepo.save(assignment);
  }

  async deleteAssignmentsForStage(cohortId: string, stageId: string): Promise<number> {
    const result = await this.assignmentRepo.delete({ cohortId, stageId });
    return result.affected || 0;
  }

  async getStageStats(cohortId: string, stageId: string): Promise<{
    totalAssignments: number;
    completed: number;
    pending: number;
    inProgress: number;
    skipped: number;
    overdue: number;
    averageScore: number;
  }> {
    const assignments = await this.assignmentRepo.find({
      where: { cohortId, stageId },
    });

    const reviews = await this.reviewRepo
      .createQueryBuilder("review")
      .leftJoin("review.assignment", "assignment")
      .where("assignment.cohortId = :cohortId", { cohortId })
      .andWhere("assignment.stageId = :stageId", { stageId })
      .getMany();

    const now = new Date();
    const overdue = assignments.filter(
      (a) => a.status !== PeerReviewAssignmentStatus.COMPLETED && new Date(a.dueDate) < now,
    ).length;

    const averageScore =
      reviews.length > 0 ? reviews.reduce((sum, r) => sum + Number(r.overallScore), 0) / reviews.length : 0;

    return {
      totalAssignments: assignments.length,
      completed: assignments.filter((a) => a.status === PeerReviewAssignmentStatus.COMPLETED).length,
      pending: assignments.filter((a) => a.status === PeerReviewAssignmentStatus.PENDING).length,
      inProgress: assignments.filter((a) => a.status === PeerReviewAssignmentStatus.IN_PROGRESS).length,
      skipped: assignments.filter((a) => a.status === PeerReviewAssignmentStatus.SKIPPED).length,
      overdue,
      averageScore: Math.round(averageScore * 100) / 100,
    };
  }

  async getTeamReviewSummary(teamId: string): Promise<{
    reviewsGiven: number;
    reviewsReceived: number;
    averageScoreGiven: number;
    averageScoreReceived: number;
  }> {
    // Reviews given by this team
    const givenAssignments = await this.assignmentRepo.find({
      where: { reviewerTeamId: teamId, status: PeerReviewAssignmentStatus.COMPLETED },
      select: ["id"],
    });

    const givenReviews =
      givenAssignments.length > 0
        ? await this.reviewRepo.find({
            where: givenAssignments.map((a) => ({ assignmentId: a.id })),
          })
        : [];

    // Reviews received by this team
    const receivedAssignments = await this.assignmentRepo.find({
      where: { reviewedTeamId: teamId, status: PeerReviewAssignmentStatus.COMPLETED },
      select: ["id"],
    });

    const receivedReviews =
      receivedAssignments.length > 0
        ? await this.reviewRepo.find({
            where: receivedAssignments.map((a) => ({ assignmentId: a.id })),
          })
        : [];

    const avgGiven =
      givenReviews.length > 0
        ? givenReviews.reduce((sum, r) => sum + Number(r.overallScore), 0) / givenReviews.length
        : 0;

    const avgReceived =
      receivedReviews.length > 0
        ? receivedReviews.reduce((sum, r) => sum + Number(r.overallScore), 0) / receivedReviews.length
        : 0;

    return {
      reviewsGiven: givenReviews.length,
      reviewsReceived: receivedReviews.length,
      averageScoreGiven: Math.round(avgGiven * 100) / 100,
      averageScoreReceived: Math.round(avgReceived * 100) / 100,
    };
  }
}
