import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Like, IsNull } from "typeorm";
import {
  ForumCategory,
  ForumThread,
  ForumReply,
  ForumThreadView,
  ForumAuthorType,
} from "@/database/entities/forum.entity";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateThreadDto,
  UpdateThreadDto,
  CreateReplyDto,
  UpdateReplyDto,
  ThreadQueryDto,
  CategoryResponseDto,
  ThreadResponseDto,
  ReplyResponseDto,
  ThreadDetailResponseDto,
  PaginatedThreadsDto,
} from "./dto/forum.dto";

export interface AuthorInfo {
  id: string;
  type: ForumAuthorType;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    @InjectRepository(ForumCategory)
    private readonly categoryRepository: Repository<ForumCategory>,
    @InjectRepository(ForumThread)
    private readonly threadRepository: Repository<ForumThread>,
    @InjectRepository(ForumReply)
    private readonly replyRepository: Repository<ForumReply>,
    @InjectRepository(ForumThreadView)
    private readonly viewRepository: Repository<ForumThreadView>
  ) {}

  // ============ Category Operations ============

  async createCategory(dto: CreateCategoryDto): Promise<ForumCategory> {
    const category = this.categoryRepository.create({
      name: dto.name,
      description: dto.description,
      cohortId: dto.cohortId,
      verticalId: dto.verticalId,
      iconName: dto.iconName,
      sortOrder: dto.sortOrder ?? 0,
      staffOnly: dto.staffOnly ?? false,
    });

    return this.categoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto
  ): Promise<ForumCategory> {
    const category = await this.findCategoryById(id);
    Object.assign(category, dto);
    return this.categoryRepository.save(category);
  }

  async findCategoryById(id: string): Promise<ForumCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  async getCategories(
    cohortId: string,
    verticalId?: string,
    includeStaffOnly = false
  ): Promise<CategoryResponseDto[]> {
    const queryBuilder = this.categoryRepository
      .createQueryBuilder("category")
      .where("category.cohort_id = :cohortId", { cohortId })
      .andWhere("category.is_active = :isActive", { isActive: true });

    // Filter by vertical: show global (null) and vertical-specific
    if (verticalId) {
      queryBuilder.andWhere(
        "(category.vertical_id IS NULL OR category.vertical_id = :verticalId)",
        { verticalId }
      );
    } else {
      queryBuilder.andWhere("category.vertical_id IS NULL");
    }

    // Filter staff-only if not staff
    if (!includeStaffOnly) {
      queryBuilder.andWhere("category.staff_only = :staffOnly", {
        staffOnly: false,
      });
    }

    queryBuilder.orderBy("category.sort_order", "ASC");

    const categories = await queryBuilder.getMany();

    // Get thread counts and last activity for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const [threadCount, lastThread] = await Promise.all([
          this.threadRepository.count({
            where: { categoryId: category.id, isDeleted: false },
          }),
          this.threadRepository.findOne({
            where: { categoryId: category.id, isDeleted: false },
            order: { lastReplyAt: "DESC" },
            select: ["lastReplyAt", "createdAt"],
          }),
        ]);

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          cohortId: category.cohortId,
          verticalId: category.verticalId,
          iconName: category.iconName,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          staffOnly: category.staffOnly,
          isLocked: category.isLocked,
          threadCount,
          lastActivity: lastThread?.lastReplyAt || lastThread?.createdAt,
          createdAt: category.createdAt,
        } as CategoryResponseDto;
      })
    );

    return categoriesWithStats;
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.findCategoryById(id);
    await this.categoryRepository.remove(category);
  }

  // ============ Thread Operations ============

  async createThread(
    dto: CreateThreadDto,
    author: AuthorInfo
  ): Promise<ForumThread> {
    const category = await this.findCategoryById(dto.categoryId);

    // Check if category is locked
    if (category.isLocked) {
      throw new ForbiddenException("This category is locked");
    }

    // Check staff-only permission
    if (category.staffOnly && author.type !== ForumAuthorType.STAFF) {
      throw new ForbiddenException(
        "Only staff can create threads in this category"
      );
    }

    const thread = this.threadRepository.create({
      categoryId: dto.categoryId,
      title: dto.title,
      content: dto.content,
      authorId: author.id,
      authorType: author.type,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
    });

    return this.threadRepository.save(thread);
  }

  async updateThread(
    id: string,
    dto: UpdateThreadDto,
    author: AuthorInfo
  ): Promise<ForumThread> {
    const thread = await this.findThreadById(id);

    // Check ownership or staff
    if (
      thread.authorId !== author.id &&
      author.type !== ForumAuthorType.STAFF
    ) {
      throw new ForbiddenException("Not authorized to edit this thread");
    }

    if (dto.title) thread.title = dto.title;
    if (dto.content) thread.content = dto.content;
    thread.isEdited = true;
    thread.editedAt = new Date();

    return this.threadRepository.save(thread);
  }

  async findThreadById(id: string): Promise<ForumThread> {
    const thread = await this.threadRepository.findOne({
      where: { id, isDeleted: false },
      relations: ["category"],
    });

    if (!thread) {
      throw new NotFoundException("Thread not found");
    }

    return thread;
  }

  async getThreads(
    categoryId: string,
    query: ThreadQueryDto
  ): Promise<PaginatedThreadsDto> {
    const { page = 1, limit = 20, search, pinnedFirst = true } = query;

    const queryBuilder = this.threadRepository
      .createQueryBuilder("thread")
      .where("thread.category_id = :categoryId", { categoryId })
      .andWhere("thread.is_deleted = :isDeleted", { isDeleted: false });

    if (search) {
      queryBuilder.andWhere(
        "(thread.title ILIKE :search OR thread.content ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    // Order by pinned first, then by last activity
    if (pinnedFirst) {
      queryBuilder.orderBy("thread.is_pinned", "DESC");
      queryBuilder.addOrderBy("thread.last_reply_at", "DESC", "NULLS LAST");
      queryBuilder.addOrderBy("thread.created_at", "DESC");
    } else {
      queryBuilder.orderBy("thread.last_reply_at", "DESC", "NULLS LAST");
      queryBuilder.addOrderBy("thread.created_at", "DESC");
    }

    const [threads, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: threads.map((t) => this.mapThreadToResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getThreadDetail(
    id: string,
    viewer?: AuthorInfo
  ): Promise<ThreadDetailResponseDto> {
    const thread = await this.threadRepository.findOne({
      where: { id, isDeleted: false },
      relations: ["category", "replies"],
    });

    if (!thread) {
      throw new NotFoundException("Thread not found");
    }

    // Track view
    if (viewer) {
      await this.trackView(id, viewer);
    }

    // Get replies (non-deleted, ordered by creation)
    const replies = await this.replyRepository.find({
      where: { threadId: id, isDeleted: false },
      order: { createdAt: "ASC" },
    });

    return {
      ...this.mapThreadToResponse(thread),
      replies: replies.map((r) => this.mapReplyToResponse(r)),
      category: {
        id: thread.category.id,
        name: thread.category.name,
      },
    };
  }

  async deleteThread(id: string, author: AuthorInfo): Promise<void> {
    const thread = await this.findThreadById(id);

    // Check ownership or staff
    if (
      thread.authorId !== author.id &&
      author.type !== ForumAuthorType.STAFF
    ) {
      throw new ForbiddenException("Not authorized to delete this thread");
    }

    thread.isDeleted = true;
    thread.deletedBy = author.id;
    await this.threadRepository.save(thread);
  }

  async pinThread(id: string, isPinned: boolean): Promise<ForumThread> {
    const thread = await this.findThreadById(id);
    thread.isPinned = isPinned;
    return this.threadRepository.save(thread);
  }

  async lockThread(id: string, isLocked: boolean): Promise<ForumThread> {
    const thread = await this.findThreadById(id);
    thread.isLocked = isLocked;
    return this.threadRepository.save(thread);
  }

  private async trackView(threadId: string, viewer: AuthorInfo): Promise<void> {
    try {
      // Upsert view record
      await this.viewRepository
        .createQueryBuilder()
        .insert()
        .into(ForumThreadView)
        .values({
          threadId,
          viewerId: viewer.id,
          viewerType: viewer.type,
          lastViewedAt: new Date(),
        })
        .orUpdate(["last_viewed_at"], ["thread_id", "viewer_id", "viewer_type"])
        .execute();

      // Increment view count (only on first view per user)
      await this.threadRepository
        .createQueryBuilder()
        .update(ForumThread)
        .set({ viewCount: () => "view_count + 1" })
        .where("id = :id", { id: threadId })
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM forum_thread_views 
            WHERE thread_id = :id 
            AND viewer_id = :viewerId 
            AND viewer_type = :viewerType
            AND last_viewed_at < NOW() - INTERVAL '1 hour'
          )`,
          { id: threadId, viewerId: viewer.id, viewerType: viewer.type }
        )
        .execute();
    } catch (error) {
      // Non-critical, log and continue
      this.logger.warn(`Failed to track view: ${error.message}`);
    }
  }

  // ============ Reply Operations ============

  async createReply(
    threadId: string,
    dto: CreateReplyDto,
    author: AuthorInfo
  ): Promise<ForumReply> {
    const thread = await this.findThreadById(threadId);

    // Check if thread/category is locked
    if (thread.isLocked) {
      throw new ForbiddenException("This thread is locked");
    }

    const category = await this.findCategoryById(thread.categoryId);
    if (category.isLocked) {
      throw new ForbiddenException("This category is locked");
    }

    // Validate parent reply if provided
    if (dto.parentReplyId) {
      const parentReply = await this.replyRepository.findOne({
        where: { id: dto.parentReplyId, threadId, isDeleted: false },
      });
      if (!parentReply) {
        throw new BadRequestException("Parent reply not found");
      }
    }

    const reply = this.replyRepository.create({
      threadId,
      content: dto.content,
      authorId: author.id,
      authorType: author.type,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      parentReplyId: dto.parentReplyId,
    });

    const savedReply = await this.replyRepository.save(reply);

    // Update thread reply count and last reply info
    await this.threadRepository.update(threadId, {
      replyCount: () => "reply_count + 1",
      lastReplyAt: new Date(),
      lastReplyAuthorName: author.name,
    });

    return savedReply;
  }

  async updateReply(
    id: string,
    dto: UpdateReplyDto,
    author: AuthorInfo
  ): Promise<ForumReply> {
    const reply = await this.findReplyById(id);

    // Check ownership or staff
    if (reply.authorId !== author.id && author.type !== ForumAuthorType.STAFF) {
      throw new ForbiddenException("Not authorized to edit this reply");
    }

    reply.content = dto.content;
    reply.isEdited = true;
    reply.editedAt = new Date();

    return this.replyRepository.save(reply);
  }

  async findReplyById(id: string): Promise<ForumReply> {
    const reply = await this.replyRepository.findOne({
      where: { id, isDeleted: false },
    });

    if (!reply) {
      throw new NotFoundException("Reply not found");
    }

    return reply;
  }

  async deleteReply(id: string, author: AuthorInfo): Promise<void> {
    const reply = await this.findReplyById(id);

    // Check ownership or staff
    if (reply.authorId !== author.id && author.type !== ForumAuthorType.STAFF) {
      throw new ForbiddenException("Not authorized to delete this reply");
    }

    reply.isDeleted = true;
    reply.deletedBy = author.id;
    await this.replyRepository.save(reply);

    // Update thread reply count
    await this.threadRepository.decrement(
      { id: reply.threadId },
      "replyCount",
      1
    );
  }

  async markAsSolution(
    replyId: string,
    threadId: string,
    markedBy: AuthorInfo
  ): Promise<ForumReply> {
    const thread = await this.findThreadById(threadId);
    const reply = await this.findReplyById(replyId);

    if (reply.threadId !== threadId) {
      throw new BadRequestException("Reply does not belong to this thread");
    }

    // Only thread author or staff can mark solution
    if (
      thread.authorId !== markedBy.id &&
      markedBy.type !== ForumAuthorType.STAFF
    ) {
      throw new ForbiddenException("Not authorized to mark solution");
    }

    // Unmark any existing solution
    await this.replyRepository.update(
      { threadId, isSolution: true },
      { isSolution: false, markedSolutionAt: undefined, markedSolutionBy: undefined }
    );

    // Mark new solution
    reply.isSolution = true;
    reply.markedSolutionAt = new Date();
    reply.markedSolutionBy = markedBy.id;

    return this.replyRepository.save(reply);
  }

  // ============ Helper Methods ============

  private mapThreadToResponse(thread: ForumThread): ThreadResponseDto {
    return {
      id: thread.id,
      categoryId: thread.categoryId,
      title: thread.title,
      content: thread.content,
      authorId: thread.authorId,
      authorType: thread.authorType,
      authorName: thread.authorName,
      authorAvatarUrl: thread.authorAvatarUrl,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      isEdited: thread.isEdited,
      editedAt: thread.editedAt,
      replyCount: thread.replyCount,
      lastReplyAt: thread.lastReplyAt,
      lastReplyAuthorName: thread.lastReplyAuthorName,
      viewCount: thread.viewCount,
      createdAt: thread.createdAt,
    };
  }

  private mapReplyToResponse(reply: ForumReply): ReplyResponseDto {
    return {
      id: reply.id,
      threadId: reply.threadId,
      content: reply.content,
      authorId: reply.authorId,
      authorType: reply.authorType,
      authorName: reply.authorName,
      authorAvatarUrl: reply.authorAvatarUrl,
      parentReplyId: reply.parentReplyId,
      isEdited: reply.isEdited,
      editedAt: reply.editedAt,
      isSolution: reply.isSolution,
      createdAt: reply.createdAt,
    };
  }
}
