import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, LessThanOrEqual } from "typeorm";
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementStatus,
} from "@/database/entities/announcement.entity";
import { TeamMember } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/common/cache/cache.service";
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementQueryDto,
} from "./dto/announcement.dto";

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private announcementRepository: Repository<Announcement>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Participant)
    private participantRepository: Repository<Participant>,
    private cacheService: CacheService,
  ) {}

  async create(dto: CreateAnnouncementDto, userId: string): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      ...dto,
      audience: dto.audience || AnnouncementAudience.ALL,
      audienceValue: dto.audienceValue || null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      status: dto.publishImmediately
        ? AnnouncementStatus.PUBLISHED
        : dto.scheduledAt
          ? AnnouncementStatus.SCHEDULED
          : AnnouncementStatus.DRAFT,
      publishedAt: dto.publishImmediately ? new Date() : null,
      createdById: userId,
    });

    const saved = await this.announcementRepository.save(announcement);
    
    // Invalidate announcements cache for the cohort
    if (dto.cohortId) {
      await this.cacheService.invalidateAnnouncement(saved.id, dto.cohortId);
    }

    return saved;
  }

  async findAll(query: AnnouncementQueryDto): Promise<{
    data: Announcement[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const { cohortId, status, audience, limit = 20, offset = 0 } = query;

    const qb = this.announcementRepository
      .createQueryBuilder("announcement")
      .leftJoinAndSelect("announcement.createdBy", "createdBy")
      .where("announcement.cohortId = :cohortId", { cohortId });

    if (status) {
      qb.andWhere("announcement.status = :status", { status });
    }

    if (audience) {
      qb.andWhere("announcement.audience = :audience", { audience });
    }

    qb.orderBy("announcement.isPinned", "DESC")
      .addOrderBy("announcement.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, limit, offset },
    };
  }

  async findOne(id: string): Promise<Announcement> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
      relations: ["createdBy", "cohort"],
    });

    if (!announcement) {
      throw new NotFoundException("Announcement not found");
    }

    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const announcement = await this.findOne(id);

    Object.assign(announcement, {
      ...dto,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : announcement.scheduledAt,
    });

    // If setting to published, set publishedAt
    if (dto.status === AnnouncementStatus.PUBLISHED && !announcement.publishedAt) {
      announcement.publishedAt = new Date();
    }

    const saved = await this.announcementRepository.save(announcement);
    
    // Invalidate cache
    await this.cacheService.invalidateAnnouncement(id, announcement.cohortId);

    return saved;
  }

  async publish(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);
    announcement.status = AnnouncementStatus.PUBLISHED;
    announcement.publishedAt = new Date();
    const saved = await this.announcementRepository.save(announcement);
    
    // Invalidate cache
    await this.cacheService.invalidateAnnouncement(id, announcement.cohortId);
    
    return saved;
  }

  async archive(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);
    announcement.status = AnnouncementStatus.ARCHIVED;
    const saved = await this.announcementRepository.save(announcement);
    
    // Invalidate cache
    await this.cacheService.invalidateAnnouncement(id, announcement.cohortId);
    
    return saved;
  }

  async delete(id: string): Promise<void> {
    const announcement = await this.findOne(id);
    const cohortId = announcement.cohortId;
    await this.announcementRepository.remove(announcement);
    
    // Invalidate cache
    await this.cacheService.invalidateAnnouncement(id, cohortId);
  }

  async incrementReadCount(id: string): Promise<void> {
    await this.announcementRepository.increment({ id }, "readCount", 1);
  }

  /**
   * Get announcements for a participant based on their team/vertical membership
   */
  async findForParticipant(
    participantId: string,
    cohortId?: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    data: Announcement[];
    meta: { total: number; limit: number; offset: number };
  }> {
    // Get participant info
    const participant = await this.participantRepository.findOne({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    // Get participant's team memberships
    const teamMembers = await this.teamMemberRepository.find({
      where: { participantId },
      relations: ["team", "team.brief"],
    });

    const teamIds = teamMembers.map((tm) => tm.team.id);
    const verticalIds = teamMembers
      .filter((tm) => tm.team.brief?.verticalId)
      .map((tm) => tm.team.brief!.verticalId);

    const qb = this.announcementRepository
      .createQueryBuilder("announcement")
      .leftJoinAndSelect("announcement.createdBy", "createdBy")
      .where("announcement.status = :status", { status: AnnouncementStatus.PUBLISHED });

    if (cohortId) {
      qb.andWhere("announcement.cohortId = :cohortId", { cohortId });
    }

    // Filter by audience targeting
    qb.andWhere(
      `(
        announcement.audience = :all
        OR (announcement.audience = :vertical AND announcement.audienceValue && :verticalIds)
        OR (announcement.audience = :team AND announcement.audienceValue && :teamIds)
      )`,
      {
        all: AnnouncementAudience.ALL,
        vertical: AnnouncementAudience.VERTICAL,
        team: AnnouncementAudience.TEAM,
        verticalIds: verticalIds.length > 0 ? verticalIds : ["none"],
        teamIds: teamIds.length > 0 ? teamIds : ["none"],
      },
    );

    qb.orderBy("announcement.isPinned", "DESC")
      .addOrderBy("announcement.publishedAt", "DESC")
      .skip(offset)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, limit, offset },
    };
  }

  /**
   * Get announcements for an organization
   */
  async findForOrganization(
    organizationId: string,
    cohortId?: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    data: Announcement[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const qb = this.announcementRepository
      .createQueryBuilder("announcement")
      .leftJoinAndSelect("announcement.createdBy", "createdBy")
      .where("announcement.status = :status", { status: AnnouncementStatus.PUBLISHED })
      .andWhere(
        "(announcement.audience = :all OR announcement.audience = :org)",
        {
          all: AnnouncementAudience.ALL,
          org: AnnouncementAudience.ORGANIZATION,
        },
      );

    if (cohortId) {
      qb.andWhere("announcement.cohortId = :cohortId", { cohortId });
    }

    qb.orderBy("announcement.isPinned", "DESC")
      .addOrderBy("announcement.publishedAt", "DESC")
      .skip(offset)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, limit, offset },
    };
  }

  /**
   * Get announcements for a mentor
   */
  async findForMentor(
    mentorId: string,
    cohortId?: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    data: Announcement[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const qb = this.announcementRepository
      .createQueryBuilder("announcement")
      .leftJoinAndSelect("announcement.createdBy", "createdBy")
      .where("announcement.status = :status", { status: AnnouncementStatus.PUBLISHED })
      .andWhere(
        "(announcement.audience = :all OR announcement.audience = :mentor)",
        {
          all: AnnouncementAudience.ALL,
          mentor: AnnouncementAudience.MENTOR,
        },
      );

    if (cohortId) {
      qb.andWhere("announcement.cohortId = :cohortId", { cohortId });
    }

    qb.orderBy("announcement.isPinned", "DESC")
      .addOrderBy("announcement.publishedAt", "DESC")
      .skip(offset)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, limit, offset },
    };
  }

  /**
   * Process scheduled announcements (called by cron job)
   */
  async publishScheduledAnnouncements(): Promise<number> {
    const now = new Date();
    const scheduled = await this.announcementRepository.find({
      where: {
        status: AnnouncementStatus.SCHEDULED,
        scheduledAt: LessThanOrEqual(now),
      },
    });

    for (const announcement of scheduled) {
      announcement.status = AnnouncementStatus.PUBLISHED;
      announcement.publishedAt = now;
      await this.announcementRepository.save(announcement);
    }

    return scheduled.length;
  }
}
