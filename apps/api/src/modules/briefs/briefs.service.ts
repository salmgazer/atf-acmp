import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, In } from "typeorm";
import { Brief, BriefStatus, BriefRevision, BriefRevisionAction } from "@/database/entities/brief.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { EmailService } from "@/email/email.service";
import { NotificationTriggersService } from "@/modules/notifications/notification-triggers.service";
import { UsersService } from "@/modules/users/users.service";
import {
  CreateBriefDto,
  UpdateBriefDto,
  SubmitBriefDto,
  ReviewBriefDto,
  BriefQueryDto,
  PaginatedBriefsDto,
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

    const brief = this.briefRepository.create({
      ...dto,
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

    const [data, total] = await this.briefRepository.findAndCount({
      where,
      relations: ["vertical", "organization"],
      order: { createdAt: "DESC" },
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

    return queryBuilder
      .orderBy("brief.approvedAt", "DESC")
      .getMany();
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

  async update(id: string, dto: UpdateBriefDto): Promise<Brief> {
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

    // Store previous data for revision history
    const previousData = {
      title: brief.title,
      description: brief.description,
      problemStatement: brief.problemStatement,
      expectedOutcomes: brief.expectedOutcomes,
      verticalId: brief.verticalId,
    };

    Object.assign(brief, dto);
    const updated = await this.briefRepository.save(brief);

    // Create revision record
    await this.createRevision(id, BriefRevisionAction.UPDATED, undefined, undefined, previousData, dto);

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
    await this.createRevision(id, BriefRevisionAction.SUBMITTED, undefined, dto.submissionNotes);

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
    await this.createRevision(id, revisionAction, dto.reviewedBy, dto.feedback);

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

  private async createRevision(
    briefId: string,
    action: BriefRevisionAction,
    actorId?: string,
    comment?: string,
    previousData?: Record<string, any>,
    newData?: Record<string, any>
  ): Promise<BriefRevision> {
    const revision = this.revisionRepository.create({
      briefId,
      action,
      actorId,
      comment,
      previousData,
      newData,
    });

    return this.revisionRepository.save(revision);
  }
}
