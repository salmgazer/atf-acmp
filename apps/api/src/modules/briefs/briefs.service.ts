import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, In } from "typeorm";
import { Brief, BriefStatus, BriefRevision, BriefRevisionAction, BriefRevisionActorType, calculateBriefScores, ScoringAnswers } from "@/database/entities/brief.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { EmailService } from "@/email/email.service";
import { NotificationTriggersService } from "@/modules/notifications/notification-triggers.service";
import { UsersService } from "@/modules/users/users.service";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/common/cache/cache.service";
import {
  CreateBriefDto,
  UpdateBriefDto,
  SubmitBriefDto,
  ReviewBriefDto,
  BriefQueryDto,
  PaginatedBriefsDto,
  StaffUpdateBriefDto,
} from "./dto/brief.dto";

@Injectable()
export class BriefsService {
  private readonly logger = new Logger(BriefsService.name);

  constructor(
    @InjectRepository(Brief)
    private readonly briefRepository: Repository<Brief>,
    @InjectRepository(BriefRevision)
    private readonly revisionRepository: Repository<BriefRevision>,
    @InjectRepository(Vertical)
    private readonly verticalRepository: Repository<Vertical>,
    private readonly emailService: EmailService,
    private readonly notificationTriggers: NotificationTriggersService,
    private readonly usersService: UsersService,
    private readonly cacheService: CacheService,
  ) {}

  async create(dto: CreateBriefDto): Promise<Brief> {
    // Check vertical capacity if verticalId provided
    if (dto.verticalId) {
      const vertical = await this.verticalRepository.findOne({
        where: { id: dto.verticalId },
      });

      if (!vertical) {
        throw new NotFoundException("Vertical not found");
      }

      if (vertical.briefCount >= vertical.briefCap) {
        throw new ConflictException(
          `Vertical "${vertical.name}" has reached its brief capacity (${vertical.briefCap})`
        );
      }
    }

    // Calculate scores if scoringAnswers provided
    let scoringData = {};
    if (dto.scoringAnswers && Object.keys(dto.scoringAnswers).some(k => dto.scoringAnswers![k as keyof ScoringAnswers])) {
      const scores = calculateBriefScores(dto.scoringAnswers);
      scoringData = {
        fitScore: scores.fitScore,
        fitBand: scores.fitBand,
        scoreOverride: scores.scoreOverride,
        depthScore: scores.depthScore,
        breadthScore: scores.breadthScore,
        impactScore: scores.impactScore,
        impactBand: scores.impactBand,
        priorityScore: scores.priorityScore,
      };
    }

    const brief = this.briefRepository.create({
      ...dto,
      ...scoringData,
      status: BriefStatus.DRAFT,
    });

    return this.briefRepository.save(brief);
  }

  async findAll(query: BriefQueryDto): Promise<PaginatedBriefsDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.cohortId) {
      where.cohortId = query.cohortId;
    }

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.verticalId) {
      where.verticalId = query.verticalId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.title = ILike(`%${query.search}%`);
    }

    // Determine sort order
    let order: any = { createdAt: "DESC" };
    if (query.sortBy === "priority") {
      order = { priorityScore: query.sortOrder === "asc" ? "ASC" : "DESC", createdAt: "DESC" };
    } else if (query.sortBy === "fitScore") {
      order = { fitScore: query.sortOrder === "asc" ? "ASC" : "DESC", createdAt: "DESC" };
    } else if (query.sortBy === "impactScore") {
      order = { impactScore: query.sortOrder === "asc" ? "ASC" : "DESC", createdAt: "DESC" };
    } else if (query.sortBy === "createdAt") {
      order = { createdAt: query.sortOrder === "asc" ? "ASC" : "DESC" };
    } else if (query.sortBy === "updatedAt") {
      order = { updatedAt: query.sortOrder === "asc" ? "ASC" : "DESC" };
    }

    const [data, total] = await this.briefRepository.findAndCount({
      where,
      relations: ["vertical", "organization"],
      order,
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findApproved(cohortId: string, verticalId?: string, search?: string): Promise<Brief[]> {
    // Only use cache if no filters (most common case)
    if (!verticalId && !search) {
      const cacheKey = this.cacheService.buildKey(CACHE_KEYS.BRIEFS_BY_COHORT, cohortId, "approved");
      const cached = await this.cacheService.get<Brief[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const queryBuilder = this.briefRepository
      .createQueryBuilder("brief")
      .leftJoinAndSelect("brief.vertical", "vertical")
      .leftJoinAndSelect("brief.organization", "organization")
      .where("brief.cohortId = :cohortId", { cohortId })
      .andWhere("brief.status = :status", { status: BriefStatus.APPROVED });

    if (verticalId) {
      queryBuilder.andWhere("brief.verticalId = :verticalId", { verticalId });
    }

    if (search) {
      queryBuilder.andWhere(
        "(brief.title ILIKE :search OR organization.name ILIKE :search OR brief.tags::text ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    const results = await queryBuilder
      .orderBy("brief.approvedAt", "DESC")
      .getMany();

    // Cache results if no filters
    if (!verticalId && !search) {
      const cacheKey = this.cacheService.buildKey(CACHE_KEYS.BRIEFS_BY_COHORT, cohortId, "approved");
      await this.cacheService.set(cacheKey, results, CACHE_TTL.MEDIUM);
    }

    return results;
  }

  async findOne(id: string): Promise<Brief> {
    const brief = await this.briefRepository.findOne({
      where: { id },
      relations: ["vertical", "organization", "cohort", "revisions"],
    });

    if (!brief) {
      throw new NotFoundException("Brief not found");
    }

    return brief;
  }

  async update(id: string, dto: UpdateBriefDto, actorId?: string, actorName?: string): Promise<Brief> {
    const brief = await this.findOne(id);

    // Only allow updates in DRAFT or REVISION_REQUESTED status
    if (![BriefStatus.DRAFT, BriefStatus.REVISION_REQUESTED].includes(brief.status)) {
      throw new BadRequestException(
        `Cannot update brief with status: ${brief.status}. Only drafts and revision requests can be edited.`
      );
    }

    // Handle vertical change - check new vertical capacity
    if (dto.verticalId && dto.verticalId !== brief.verticalId) {
      const newVertical = await this.verticalRepository.findOne({
        where: { id: dto.verticalId },
      });

      if (!newVertical) {
        throw new NotFoundException("Vertical not found");
      }

      if (newVertical.briefCount >= newVertical.briefCap) {
        throw new ConflictException(
          `Vertical "${newVertical.name}" has reached its brief capacity`
        );
      }
    }

    // Store previous data for revision history (capture all editable fields)
    const previousData = {
      title: brief.title,
      description: brief.description,
      problemStatement: brief.problemStatement,
      expectedOutcomes: brief.expectedOutcomes,
      verticalId: brief.verticalId,
      tags: Array.isArray(brief.tags) ? brief.tags : [],
      resources: brief.resources,
      maxTeams: brief.maxTeams,
    };

    // Calculate scores if scoringAnswers provided
    let scoringData = {};
    const answers = dto.scoringAnswers || brief.scoringAnswers;
    if (answers && Object.keys(answers).some(k => answers[k as keyof ScoringAnswers])) {
      const scores = calculateBriefScores(answers);
      scoringData = {
        fitScore: scores.fitScore,
        fitBand: scores.fitBand,
        scoreOverride: scores.scoreOverride,
        depthScore: scores.depthScore,
        breadthScore: scores.breadthScore,
        impactScore: scores.impactScore,
        impactBand: scores.impactBand,
        priorityScore: scores.priorityScore,
      };
    }

    // Increment version
    const newVersion = brief.currentVersion + 1;
    brief.currentVersion = newVersion;

    Object.assign(brief, dto, scoringData);
    const updated = await this.briefRepository.save(brief);

    // Create revision record with actor info
    await this.createRevision(
      id, 
      BriefRevisionAction.UPDATED, 
      actorId, 
      actorName,
      BriefRevisionActorType.ORGANIZATION,
      undefined, 
      previousData, 
      dto,
      newVersion
    );

    return updated;
  }

  async submit(id: string, dto: SubmitBriefDto): Promise<Brief> {
    const brief = await this.findOne(id);

    if (![BriefStatus.DRAFT, BriefStatus.REVISION_REQUESTED].includes(brief.status)) {
      throw new BadRequestException(
        `Cannot submit brief with status: ${brief.status}`
      );
    }

    // Check vertical capacity
    if (brief.verticalId) {
      const vertical = await this.verticalRepository.findOne({
        where: { id: brief.verticalId },
      });

      if (vertical && vertical.briefCount >= vertical.briefCap) {
        throw new ConflictException(
          `Vertical "${vertical.name}" has reached its brief capacity. Cannot submit.`
        );
      }
    }

    brief.status = BriefStatus.SUBMITTED;
    brief.submittedAt = new Date();

    const submitted = await this.briefRepository.save(brief);

    // Update vertical brief count
    if (brief.verticalId) {
      await this.verticalRepository.increment(
        { id: brief.verticalId },
        "briefCount",
        1
      );
    }

    // Create revision record
    await this.createRevision(
      id, 
      BriefRevisionAction.SUBMITTED, 
      undefined, 
      undefined,
      BriefRevisionActorType.ORGANIZATION,
      dto.submissionNotes,
      undefined,
      undefined,
      brief.currentVersion
    );

    // Notify staff about new submission
    try {
      const staffIds = await this.usersService.getActiveReviewerIds();
      if (staffIds.length > 0) {
        await this.notificationTriggers.onBriefSubmitted({
          staffUserIds: staffIds,
          organizationName: brief.organization?.name || "An organization",
          briefId: brief.id,
          briefTitle: brief.title,
          verticalName: brief.vertical?.name,
        });
        this.logger.log(`Sent brief submission notification to ${staffIds.length} staff members for brief ${brief.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send brief submission notification for brief ${brief.id}`, error);
      // Don't throw - the submission itself was successful
    }

    return submitted;
  }

  async startReview(id: string, reviewerId?: string): Promise<Brief> {
    const brief = await this.findOne(id);

    if (brief.status !== BriefStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot start review for brief with status: ${brief.status}`
      );
    }

    brief.status = BriefStatus.IN_REVIEW;
    brief.reviewedBy = reviewerId;

    return this.briefRepository.save(brief);
  }

  async review(id: string, dto: ReviewBriefDto): Promise<Brief> {
    const brief = await this.findOne(id);

    if (![BriefStatus.SUBMITTED, BriefStatus.IN_REVIEW].includes(brief.status)) {
      throw new BadRequestException(
        `Cannot review brief with status: ${brief.status}`
      );
    }

    // Require feedback for rejections and revision requests
    if ((dto.action === "rejected" || dto.action === "revision_requested") && !dto.feedback?.trim()) {
      throw new BadRequestException("Feedback is required when rejecting or requesting revisions");
    }

    let newStatus: BriefStatus;
    let revisionAction: BriefRevisionAction;

    switch (dto.action) {
      case "approved":
        newStatus = BriefStatus.APPROVED;
        revisionAction = BriefRevisionAction.APPROVED;
        brief.approvedAt = new Date();
        break;
      case "rejected":
        newStatus = BriefStatus.REJECTED;
        revisionAction = BriefRevisionAction.REJECTED;
        // Decrement vertical count if it was counted
        if (brief.verticalId && brief.status !== BriefStatus.DRAFT) {
          await this.verticalRepository.decrement(
            { id: brief.verticalId },
            "briefCount",
            1
          );
        }
        break;
      case "revision_requested":
        newStatus = BriefStatus.REVISION_REQUESTED;
        revisionAction = BriefRevisionAction.REVISION_REQUESTED;
        brief.revisionCount += 1;
        // Decrement vertical count temporarily
        if (brief.verticalId) {
          await this.verticalRepository.decrement(
            { id: brief.verticalId },
            "briefCount",
            1
          );
        }
        break;
      default:
        throw new BadRequestException("Invalid review action");
    }

    brief.status = newStatus;
    brief.reviewFeedback = dto.feedback;
    brief.reviewedBy = dto.reviewedBy;
    brief.reviewedAt = new Date();

    const reviewed = await this.briefRepository.save(brief);

    // Create revision record
    await this.createRevision(
      id, 
      revisionAction, 
      dto.reviewedBy, 
      undefined,
      BriefRevisionActorType.STAFF,
      dto.feedback,
      undefined,
      undefined,
      brief.currentVersion
    );

    // Send in-app notification for all status changes
    if (brief.organizationId) {
      try {
        await this.notificationTriggers.onBriefStatusChanged({
          organizationId: brief.organizationId,
          briefId: brief.id,
          briefTitle: brief.title,
          oldStatus: brief.status === newStatus ? "submitted" : brief.status, // If equal, it just changed
          newStatus: newStatus,
        });
        this.logger.log(`Sent brief status notification to organization ${brief.organizationId} for brief ${brief.id}`);
      } catch (error) {
        this.logger.error(`Failed to send brief status notification for brief ${brief.id}`, error);
        // Don't throw - the review itself was successful
      }
    }

    // Send email notification for revision requests
    if (dto.action === "revision_requested" && brief.organization && dto.feedback) {
      try {
        await this.emailService.sendBriefRevisionRequest(
          brief.organization.name,
          brief.organization.email,
          brief.title,
          dto.feedback,
          brief.id
        );
        this.logger.log(`Sent revision request email to ${brief.organization.email} for brief ${brief.id}`);
      } catch (error) {
        this.logger.error(`Failed to send revision request email for brief ${brief.id}`, error);
        // Don't throw - the review itself was successful
      }
    }

    return reviewed;
  }

  async delete(id: string): Promise<void> {
    const brief = await this.findOne(id);

    if (brief.status !== BriefStatus.DRAFT) {
      throw new BadRequestException("Only draft briefs can be deleted");
    }

    await this.briefRepository.remove(brief);
  }

  /**
   * Update video URL for a brief (Stage B - after approval)
   * This is a separate method that allows video uploads for approved briefs
   */
  async updateVideoUrl(id: string, videoUrl: string, thumbnailUrl?: string): Promise<Brief> {
    const brief = await this.findOne(id);

    if (brief.status !== BriefStatus.APPROVED) {
      throw new BadRequestException(
        "Video can only be uploaded for approved briefs (Stage B)"
      );
    }

    brief.videoUrl = videoUrl;
    if (thumbnailUrl) {
      brief.videoThumbnailUrl = thumbnailUrl;
    }
    return this.briefRepository.save(brief);
  }

  /**
   * Add an image to the brief's image gallery (Stage B)
   * Only allowed for approved briefs
   */
  async addImage(id: string, imageUrl: string): Promise<Brief> {
    const brief = await this.findOne(id);

    if (brief.status !== BriefStatus.APPROVED) {
      throw new BadRequestException(
        "Images can only be uploaded for approved briefs (Stage B)"
      );
    }

    // Initialize array if null/undefined
    if (!brief.imageUrls) {
      brief.imageUrls = [];
    }

    // Limit to 10 images max
    if (brief.imageUrls.length >= 10) {
      throw new BadRequestException(
        "Maximum of 10 images allowed per brief"
      );
    }

    brief.imageUrls.push(imageUrl);
    return this.briefRepository.save(brief);
  }

  /**
   * Remove an image from the brief's image gallery (Stage B)
   */
  async removeImage(id: string, imageIndex: number): Promise<Brief> {
    const brief = await this.findOne(id);

    if (brief.status !== BriefStatus.APPROVED) {
      throw new BadRequestException(
        "Images can only be modified for approved briefs (Stage B)"
      );
    }

    if (!brief.imageUrls || imageIndex < 0 || imageIndex >= brief.imageUrls.length) {
      throw new BadRequestException("Invalid image index");
    }

    brief.imageUrls.splice(imageIndex, 1);
    return this.briefRepository.save(brief);
  }

  async getStatistics(cohortId?: string): Promise<{
    total: number;
    draft: number;
    submitted: number;
    inReview: number;
    approved: number;
    rejected: number;
    revisionRequested: number;
  }> {
    const where: any = {};
    if (cohortId) {
      where.cohortId = cohortId;
    }

    const statusCounts = await this.briefRepository
      .createQueryBuilder("brief")
      .select("brief.status", "status")
      .addSelect("COUNT(*)", "count")
      .where(cohortId ? "brief.cohort_id = :cohortId" : "1=1", { cohortId })
      .groupBy("brief.status")
      .getRawMany();

    const countMap: Record<string, number> = {};
    statusCounts.forEach((row) => {
      countMap[row.status] = parseInt(row.count);
    });

    return {
      total: Object.values(countMap).reduce((a, b) => a + b, 0),
      draft: countMap[BriefStatus.DRAFT] || 0,
      submitted: countMap[BriefStatus.SUBMITTED] || 0,
      inReview: countMap[BriefStatus.IN_REVIEW] || 0,
      approved: countMap[BriefStatus.APPROVED] || 0,
      rejected: countMap[BriefStatus.REJECTED] || 0,
      revisionRequested: countMap[BriefStatus.REVISION_REQUESTED] || 0,
    };
  }

  async getRevisionHistory(briefId: string): Promise<BriefRevision[]> {
    return this.revisionRepository.find({
      where: { briefId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get a single revision by ID
   */
  async getRevision(briefId: string, revisionId: string): Promise<BriefRevision> {
    const revision = await this.revisionRepository.findOne({
      where: { id: revisionId, briefId },
    });

    if (!revision) {
      throw new NotFoundException("Revision not found");
    }

    return revision;
  }

  /**
   * Restore a brief to a previous revision
   * Creates a new revision with the restored content
   */
  async restoreRevision(
    briefId: string, 
    revisionId: string, 
    actorId: string, 
    actorName: string,
    comment?: string
  ): Promise<Brief> {
    const brief = await this.findOne(briefId);
    const revision = await this.getRevision(briefId, revisionId);

    // The revision's previousData contains the state before that revision was made
    // So we want to restore TO the state captured in previousData
    if (!revision.previousData) {
      throw new BadRequestException("This revision does not contain restorable data");
    }

    // Store current state before restoring
    const currentData = {
      title: brief.title,
      description: brief.description,
      problemStatement: brief.problemStatement,
      expectedOutcomes: brief.expectedOutcomes,
      verticalId: brief.verticalId,
      tags: Array.isArray(brief.tags) ? brief.tags : [],
      resources: brief.resources,
      maxTeams: brief.maxTeams,
    };

    // Handle vertical change - check new vertical capacity if needed
    const restoredVerticalId = revision.previousData.verticalId;
    if (restoredVerticalId && restoredVerticalId !== brief.verticalId) {
      const newVertical = await this.verticalRepository.findOne({
        where: { id: restoredVerticalId },
      });

      if (!newVertical) {
        throw new NotFoundException("The vertical from the revision no longer exists");
      }

      if (brief.status !== BriefStatus.DRAFT && newVertical.briefCount >= newVertical.briefCap) {
        throw new ConflictException(
          `Cannot restore: Vertical "${newVertical.name}" has reached its brief capacity`
        );
      }
    }

    // Apply restored data
    const restorableFields = ['title', 'description', 'problemStatement', 'expectedOutcomes', 'verticalId', 'tags', 'resources', 'maxTeams'];
    const previousData = revision.previousData!;
    restorableFields.forEach(field => {
      if (previousData[field] !== undefined) {
        // For array fields (tags, resources), ensure we don't assign null
        if (field === 'tags') {
          (brief as any)[field] = Array.isArray(previousData[field]) ? previousData[field] : [];
        } else if (field === 'resources') {
          (brief as any)[field] = Array.isArray(previousData[field]) ? previousData[field] : null;
        } else {
          (brief as any)[field] = previousData[field];
        }
      }
    });

    // Increment version
    const newVersion = brief.currentVersion + 1;
    brief.currentVersion = newVersion;

    const restored = await this.briefRepository.save(brief);

    // Create revision record for the restore action
    await this.createRevision(
      briefId,
      BriefRevisionAction.RESTORED,
      actorId,
      actorName,
      BriefRevisionActorType.STAFF,
      comment || `Restored to version ${revision.version}`,
      currentData,
      revision.previousData,
      newVersion
    );

    this.logger.log(`Staff ${actorName} (${actorId}) restored brief ${briefId} to version ${revision.version}, new version is ${newVersion}`);

    return restored;
  }

  private async createRevision(
    briefId: string,
    action: BriefRevisionAction,
    actorId?: string,
    actorName?: string,
    actorType?: BriefRevisionActorType,
    comment?: string,
    previousData?: Record<string, any>,
    newData?: Record<string, any>,
    version?: number
  ): Promise<BriefRevision> {
    const revision = this.revisionRepository.create({
      briefId,
      action,
      actorId,
      actorName,
      actorType,
      comment,
      previousData,
      newData,
      version: version || 1,
    });

    return this.revisionRepository.save(revision);
  }

  /**
   * Staff update - allows staff to edit briefs regardless of status
   * Creates a revision with staff actor tracking
   */
  async staffUpdate(id: string, dto: StaffUpdateBriefDto, actorId: string, actorName: string): Promise<Brief> {
    const brief = await this.findOne(id);

    // Handle vertical change - check new vertical capacity
    if (dto.verticalId && dto.verticalId !== brief.verticalId) {
      const newVertical = await this.verticalRepository.findOne({
        where: { id: dto.verticalId },
      });

      if (!newVertical) {
        throw new NotFoundException("Vertical not found");
      }

      // Only check capacity if moving to a new vertical and brief was already submitted
      if (brief.status !== BriefStatus.DRAFT && newVertical.briefCount >= newVertical.briefCap) {
        throw new ConflictException(
          `Vertical "${newVertical.name}" has reached its brief capacity`
        );
      }
    }

    // Store previous data for revision history (capture all editable fields)
    const previousData = {
      title: brief.title,
      description: brief.description,
      problemStatement: brief.problemStatement,
      expectedOutcomes: brief.expectedOutcomes,
      verticalId: brief.verticalId,
      tags: Array.isArray(brief.tags) ? brief.tags : [],
      resources: brief.resources,
      maxTeams: brief.maxTeams,
    };

    // Calculate scores if scoringAnswers provided
    let scoringData = {};
    const answers = dto.scoringAnswers || brief.scoringAnswers;
    if (answers && Object.keys(answers).some(k => answers[k as keyof ScoringAnswers])) {
      const scores = calculateBriefScores(answers);
      scoringData = {
        fitScore: scores.fitScore,
        fitBand: scores.fitBand,
        scoreOverride: scores.scoreOverride,
        depthScore: scores.depthScore,
        breadthScore: scores.breadthScore,
        impactScore: scores.impactScore,
        impactBand: scores.impactBand,
        priorityScore: scores.priorityScore,
      };
    }

    // Increment version
    const newVersion = brief.currentVersion + 1;
    brief.currentVersion = newVersion;

    // Apply updates (excluding editComment from being saved to brief)
    const { editComment, ...updateData } = dto;
    Object.assign(brief, updateData, scoringData);
    const updated = await this.briefRepository.save(brief);

    // Create revision record with staff actor info
    await this.createRevision(
      id,
      BriefRevisionAction.UPDATED,
      actorId,
      actorName,
      BriefRevisionActorType.STAFF,
      editComment,
      previousData,
      updateData,
      newVersion
    );

    this.logger.log(`Staff ${actorName} (${actorId}) updated brief ${id} to version ${newVersion}`);

    return updated;
  }
}
