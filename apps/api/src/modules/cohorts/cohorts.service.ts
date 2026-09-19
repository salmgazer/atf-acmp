import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import { Cohort, CohortStatus } from "../../database/entities/cohort.entity";
import { Stage, StageType } from "../../database/entities/stage.entity";
import { Participant } from "../../database/entities/participant.entity";
import { Team, TeamMember } from "../../database/entities/team.entity";
import { Brief } from "../../database/entities/brief.entity";
import { Organization } from "../../database/entities/organization.entity";
import { ForumCategory } from "../../database/entities/forum.entity";
import { ChatChannel, ChannelMember, ChannelType, SenderType } from "../../database/entities/chat.entity";
import { User } from "../../database/entities/user.entity";
import {
  CreateCohortDto,
  UpdateCohortDto,
  CohortQueryDto,
  PaginatedCohortsResponseDto,
} from "./dto/cohort.dto";

// Extended cohort type with stageCount
export interface CohortWithStageCount extends Cohort {
  stageCount: number;
}

@Injectable()
export class CohortsService {
  private readonly logger = new Logger(CohortsService.name);

  // Valid status transitions map
  private readonly validTransitions: Record<CohortStatus, CohortStatus[]> = {
    [CohortStatus.DRAFT]: [CohortStatus.ACTIVE],
    [CohortStatus.ACTIVE]: [CohortStatus.EVALUATION],
    [CohortStatus.EVALUATION]: [CohortStatus.COMPLETED],
    [CohortStatus.COMPLETED]: [CohortStatus.ARCHIVED],
    [CohortStatus.ARCHIVED]: [],
  };

  // Default stages to create for new cohorts
  private readonly defaultStages = [
    { number: 1, name: "Stage 1", description: "First submission stage" },
    { number: 2, name: "Stage 2", description: "Second submission stage" },
    { number: 3, name: "Stage 3", description: "Third submission stage" },
    { number: 4, name: "Demo Day", description: "Final demo and presentation" },
  ];

  // Default forum categories to create for new cohorts
  private readonly defaultForumCategories = [
    { 
      name: "General Discussion", 
      description: "General discussions, introductions, and community building",
      iconName: "MessageSquare",
      sortOrder: 0,
    },
    { 
      name: "Technical Help", 
      description: "Ask technical questions and get help from peers and mentors",
      iconName: "HelpCircle",
      sortOrder: 1,
    },
    { 
      name: "Resources & Tips", 
      description: "Share useful resources, tutorials, and tips",
      iconName: "Lightbulb",
      sortOrder: 2,
    },
    { 
      name: "Announcements", 
      description: "Official announcements from the program team",
      iconName: "Megaphone",
      sortOrder: 3,
      staffOnly: true,
    },
  ];

  constructor(
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Brief)
    private readonly briefRepository: Repository<Brief>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(ForumCategory)
    private readonly forumCategoryRepository: Repository<ForumCategory>,
    @InjectRepository(ChatChannel)
    private readonly chatChannelRepository: Repository<ChatChannel>,
    @InjectRepository(ChannelMember)
    private readonly channelMemberRepository: Repository<ChannelMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createCohortDto: CreateCohortDto): Promise<CohortWithStageCount> {
    // Validate team size
    if (
      createCohortDto.teamSizeMin &&
      createCohortDto.teamSizeMax &&
      createCohortDto.teamSizeMin > createCohortDto.teamSizeMax
    ) {
      throw new BadRequestException("Minimum team size cannot exceed maximum team size");
    }

    const cohort = this.cohortRepository.create({
      ...createCohortDto,
      status: CohortStatus.DRAFT,
      deadlines: createCohortDto.deadlines || {},
      countries: createCohortDto.countries || [],
      verticals: createCohortDto.verticals || [],
    });

    const savedCohort = await this.cohortRepository.save(cohort);
    this.logger.log(`Created cohort: ${savedCohort.id} - ${savedCohort.name}`);

    // Auto-create default stages
    await this.createDefaultStages(savedCohort.id);

    // Auto-create default forum categories
    await this.createDefaultForumCategories(savedCohort.id);

    // Auto-create default forum chat channels
    await this.createDefaultForumChannels(savedCohort.id, savedCohort.name);

    return { ...savedCohort, stageCount: this.defaultStages.length };
  }

  private async createDefaultStages(cohortId: string): Promise<void> {
    const now = new Date();
    const stages = this.defaultStages.map((stage, index) => {
      // Default deadline: 30 days apart starting from 30 days from now
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 30 * (index + 1));

      return this.stageRepository.create({
        cohortId,
        number: stage.number,
        name: stage.name,
        description: stage.description,
        type: StageType.MIXED,
        deadline,
        weightPercentage: 25,
        isActive: true,
        allowLateSubmissions: true,
        latePenaltyPercentage: 10,
        sortOrder: stage.number,
        requirements: {},
      });
    });

    await this.stageRepository.save(stages);
    this.logger.log(`Created ${stages.length} default stages for cohort ${cohortId}`);
  }

  private async createDefaultForumCategories(cohortId: string, isActive: boolean = false): Promise<void> {
    const categories = this.defaultForumCategories.map((category) =>
      this.forumCategoryRepository.create({
        cohortId,
        name: category.name,
        description: category.description,
        iconName: category.iconName,
        sortOrder: category.sortOrder,
        staffOnly: category.staffOnly || false,
        isActive, // Only active when cohort is active
        isLocked: !isActive, // Locked until cohort is active
      })
    );

    await this.forumCategoryRepository.save(categories);
    this.logger.log(`Created ${categories.length} default forum categories for cohort ${cohortId} (active: ${isActive})`);
  }

  /**
   * Create default forum chat channels for a cohort
   * These are cohort-wide channels accessible by all participants
   * Channels start archived and are unarchived when cohort becomes active
   */
  private async createDefaultForumChannels(cohortId: string, cohortName: string, isActive: boolean = false): Promise<void> {
    const forumChannelConfigs = [
      {
        name: "General Discussion",
        description: `Open discussion for all ${cohortName} participants`,
      },
      {
        name: "Technical Help",
        description: "Get help with technical questions and issues",
      },
      {
        name: "Resources & Tips",
        description: "Share helpful resources, tutorials, and tips",
      },
      {
        name: "Announcements",
        description: "Official announcements from program staff",
      },
    ];

    const channels: ChatChannel[] = [];
    for (const config of forumChannelConfigs) {
      const channel = this.chatChannelRepository.create({
        name: config.name,
        description: config.description,
        type: ChannelType.ANNOUNCEMENT, // Using announcement type for cohort-wide forums
        cohortId,
        isPrivate: false,
        isArchived: !isActive, // Archived until cohort is active
      });
      channels.push(channel);
    }

    const savedChannels = await this.chatChannelRepository.save(channels);

    // Add all staff to the forum channels
    const staffUsers = await this.userRepository.find({
      where: { role: In(['super_admin', 'program_manager', 'evaluator'] as any) },
    });

    for (const channel of savedChannels) {
      for (const staff of staffUsers) {
        const member = this.channelMemberRepository.create({
          channelId: channel.id,
          memberId: staff.id,
          memberType: SenderType.STAFF,
          memberName: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
          isAdmin: true,
        });
        await this.channelMemberRepository.save(member);
      }
    }

    this.logger.log(`Created ${savedChannels.length} forum chat channels for cohort ${cohortId}`);
  }

  /**
   * Add a participant to all forum channels for their cohort
   */
  async addParticipantToForumChannels(participant: Participant): Promise<void> {
    const forumChannels = await this.chatChannelRepository.find({
      where: {
        cohortId: participant.cohortId,
        type: ChannelType.ANNOUNCEMENT,
        isArchived: false,
      },
    });

    for (const channel of forumChannels) {
      // Check if already a member
      const existing = await this.channelMemberRepository.findOne({
        where: {
          channelId: channel.id,
          memberId: participant.id,
          memberType: SenderType.PARTICIPANT,
        },
      });

      if (!existing) {
        const member = this.channelMemberRepository.create({
          channelId: channel.id,
          memberId: participant.id,
          memberType: SenderType.PARTICIPANT,
          memberName: `${participant.firstName} ${participant.lastName}`,
          isAdmin: false,
        });
        await this.channelMemberRepository.save(member);
      }
    }

    this.logger.log(`Added participant ${participant.id} to ${forumChannels.length} forum channels`);
  }

  /**
   * Update forum chat channels when cohort status changes
   * - ACTIVE: Unarchive all forum channels
   * - Other statuses: Archive all forum channels
   */
  private async updateForumChannelsStatus(cohortId: string, cohortStatus: CohortStatus): Promise<void> {
    const isActive = cohortStatus === CohortStatus.ACTIVE;
    
    await this.chatChannelRepository.update(
      { cohortId, type: ChannelType.ANNOUNCEMENT },
      { isArchived: !isActive }
    );

    this.logger.log(`Forum channels for cohort ${cohortId}: isArchived=${!isActive}`);
  }

  /**
   * Update forum categories when cohort status changes
   * - ACTIVE: Activate and unlock all categories
   * - Other statuses: Deactivate and lock all categories
   */
  private async updateForumCategoriesStatus(cohortId: string, cohortStatus: CohortStatus): Promise<void> {
    const isActive = cohortStatus === CohortStatus.ACTIVE;
    
    await this.forumCategoryRepository.update(
      { cohortId },
      { 
        isActive,
        isLocked: !isActive,
      }
    );

    this.logger.log(`Forum categories for cohort ${cohortId}: isActive=${isActive}, isLocked=${!isActive}`);
  }

  private async getStageCount(cohortId: string): Promise<number> {
    return this.stageRepository.count({ where: { cohortId } });
  }

  private async attachStageCount(cohort: Cohort): Promise<CohortWithStageCount> {
    const stageCount = await this.getStageCount(cohort.id);
    return { ...cohort, stageCount };
  }

  private async attachStageCounts(cohorts: Cohort[]): Promise<CohortWithStageCount[]> {
    const cohortIds = cohorts.map((c) => c.id);
    
    // Get stage counts in bulk
    const stageCounts = await this.stageRepository
      .createQueryBuilder("stage")
      .select("stage.cohort_id", "cohortId")
      .addSelect("COUNT(*)", "count")
      .where("stage.cohort_id IN (:...cohortIds)", { cohortIds })
      .groupBy("stage.cohort_id")
      .getRawMany();

    const countMap = new Map(stageCounts.map((s) => [s.cohortId, parseInt(s.count, 10)]));

    return cohorts.map((cohort) => ({
      ...cohort,
      stageCount: countMap.get(cohort.id) || 0,
    }));
  }

  async findAll(query: CohortQueryDto): Promise<PaginatedCohortsResponseDto> {
    const { status, page = 1, limit = 10 } = query;

    const queryBuilder = this.cohortRepository
      .createQueryBuilder("cohort")
      .orderBy("cohort.createdAt", "DESC");

    if (status) {
      queryBuilder.where("cohort.status = :status", { status });
    }

    const total = await queryBuilder.getCount();
    const cohorts = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Attach stage counts to all cohorts
    const data = await this.attachStageCounts(cohorts);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<CohortWithStageCount> {
    const cohort = await this.cohortRepository.findOne({ where: { id } });
    if (!cohort) {
      throw new NotFoundException(`Cohort with ID ${id} not found`);
    }
    return this.attachStageCount(cohort);
  }

  async findActive(): Promise<CohortWithStageCount | null> {
    const cohort = await this.cohortRepository.findOne({
      where: { status: CohortStatus.ACTIVE },
    });
    if (!cohort) return null;
    return this.attachStageCount(cohort);
  }

  async update(id: string, updateCohortDto: UpdateCohortDto): Promise<CohortWithStageCount> {
    const cohortWithCount = await this.findOne(id);
    const cohort = await this.cohortRepository.findOne({ where: { id } });
    if (!cohort) {
      throw new NotFoundException(`Cohort with ID ${id} not found`);
    }

    // Validate team size if both are provided
    const teamSizeMin = updateCohortDto.teamSizeMin ?? cohort.teamSizeMin;
    const teamSizeMax = updateCohortDto.teamSizeMax ?? cohort.teamSizeMax;
    if (teamSizeMin > teamSizeMax) {
      throw new BadRequestException("Minimum team size cannot exceed maximum team size");
    }

    // Merge updates
    Object.assign(cohort, updateCohortDto);

    const savedCohort = await this.cohortRepository.save(cohort);
    this.logger.log(`Updated cohort: ${savedCohort.id}`);
    return this.attachStageCount(savedCohort);
  }

  async updateStatus(id: string, newStatus: CohortStatus): Promise<CohortWithStageCount> {
    const cohortWithCount = await this.findOne(id);
    const cohort = await this.cohortRepository.findOne({ where: { id } });
    if (!cohort) {
      throw new NotFoundException(`Cohort with ID ${id} not found`);
    }

    // Validate status transition
    const allowedTransitions = this.validTransitions[cohort.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${cohort.status} to ${newStatus}. ` +
          `Allowed transitions: ${allowedTransitions.join(", ") || "none"}`
      );
    }

    // If activating, ensure no other cohort is active
    if (newStatus === CohortStatus.ACTIVE) {
      const existingActive = await this.cohortRepository.findOne({
        where: {
          status: CohortStatus.ACTIVE,
          id: Not(id),
        },
      });
      if (existingActive) {
        throw new ConflictException(
          `Cannot activate cohort. Another cohort "${existingActive.name}" is already active. ` +
            `Please complete or archive it first.`
        );
      }
    }

    cohort.status = newStatus;
    const savedCohort = await this.cohortRepository.save(cohort);
    
    // Update forum categories based on new status
    await this.updateForumCategoriesStatus(id, newStatus);
    
    // Update forum chat channels based on new status
    await this.updateForumChannelsStatus(id, newStatus);
    
    this.logger.log(`Updated cohort ${id} status to ${newStatus}`);
    return this.attachStageCount(savedCohort);
  }

  async remove(id: string): Promise<void> {
    const cohort = await this.findOne(id);

    // Only allow deleting DRAFT cohorts
    if (cohort.status !== CohortStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot delete cohort with status ${cohort.status}. Only DRAFT cohorts can be deleted.`
      );
    }

    await this.cohortRepository.softRemove(cohort);
    this.logger.log(`Soft deleted cohort: ${id}`);
  }

  async duplicate(id: string, newName: string): Promise<CohortWithStageCount> {
    const sourceWithCount = await this.findOne(id);
    const source = await this.cohortRepository.findOne({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Cohort with ID ${id} not found`);
    }

    const duplicate = this.cohortRepository.create({
      name: newName,
      description: source.description,
      teamSizeMin: source.teamSizeMin,
      teamSizeMax: source.teamSizeMax,
      deadlines: {}, // Reset deadlines for new cohort
      rubric: source.rubric,
      countries: [...source.countries],
      verticals: [...source.verticals],
      briefCap: source.briefCap,
      maxTeamsPerBrief: source.maxTeamsPerBrief,
      status: CohortStatus.DRAFT,
    });

    const savedCohort = await this.cohortRepository.save(duplicate);
    this.logger.log(`Duplicated cohort ${id} as ${savedCohort.id}`);

    // Copy stages from source cohort
    await this.duplicateStages(id, savedCohort.id);

    // Create default forum categories for the new cohort
    await this.createDefaultForumCategories(savedCohort.id);

    return this.attachStageCount(savedCohort);
  }

  private async duplicateStages(sourceCohortId: string, targetCohortId: string): Promise<void> {
    const sourceStages = await this.stageRepository.find({
      where: { cohortId: sourceCohortId },
      order: { sortOrder: "ASC" },
    });

    const newStages = sourceStages.map((stage) => {
      const { id, createdAt, updatedAt, cohortId, ...stageData } = stage;
      return this.stageRepository.create({
        ...stageData,
        cohortId: targetCohortId,
      });
    });

    if (newStages.length > 0) {
      await this.stageRepository.save(newStages);
      this.logger.log(`Duplicated ${newStages.length} stages to cohort ${targetCohortId}`);
    } else {
      // If source had no stages, create defaults
      await this.createDefaultStages(targetCohortId);
    }
  }

  async getStatistics(id: string): Promise<{
    participantCount: number;
    teamCount: number;
    briefCount: number;
    organizationCount: number;
    participantsWithoutTeam: number;
  }> {
    // Ensure cohort exists
    await this.findOne(id);

    // Get actual counts from related entities
    const [participantCount, teamCount, briefCount, organizationCount] =
      await Promise.all([
        this.participantRepository.count({ where: { cohortId: id } }),
        this.teamRepository.count({ where: { cohortId: id } }),
        this.briefRepository.count({ where: { cohortId: id } }),
        this.organizationRepository.count({ where: { cohortId: id } }),
      ]);

    // Count participants without teams
    const participantsWithTeam = await this.teamMemberRepository
      .createQueryBuilder("tm")
      .innerJoin("tm.participant", "p")
      .where("p.cohortId = :cohortId", { cohortId: id })
      .getCount();

    return {
      participantCount,
      teamCount,
      briefCount,
      organizationCount,
      participantsWithoutTeam: participantCount - participantsWithTeam,
    };
  }

  /**
   * Initialize forum categories for an existing cohort that doesn't have any
   */
  async initializeForumCategories(cohortId: string): Promise<{ message: string; categoriesCreated: number }> {
    // Verify cohort exists
    await this.findOne(cohortId);

    // Check if categories already exist
    const existingCount = await this.forumCategoryRepository.count({ where: { cohortId } });
    if (existingCount > 0) {
      throw new BadRequestException(`Cohort already has ${existingCount} forum categories`);
    }

    // Create default categories
    await this.createDefaultForumCategories(cohortId);

    return {
      message: "Forum categories initialized successfully",
      categoriesCreated: this.defaultForumCategories.length,
    };
  }
}
