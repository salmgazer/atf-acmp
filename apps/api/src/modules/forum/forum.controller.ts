import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { ForumService, AuthorInfo } from "./forum.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateThreadDto,
  UpdateThreadDto,
  CreateReplyDto,
  UpdateReplyDto,
  ThreadQueryDto,
} from "./dto/forum.dto";
import { ForumAuthorType } from "@/database/entities/forum.entity";

/**
 * Public Forum API - for participants, mentors, staff
 */
@ApiTags("forum")
@Controller("forum")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // ============ Categories ============

  @Get("categories")
  @ApiOperation({ summary: "Get forum categories for a cohort" })
  @ApiQuery({ name: "cohortId", required: true, description: "Cohort ID" })
  @ApiQuery({ name: "verticalId", required: false, description: "Filter by vertical" })
  @ApiResponse({ status: 200, description: "List of categories" })
  async getCategories(
    @Query("cohortId") cohortId: string,
    @Query("verticalId") verticalId?: string,
    @Request() req?: any
  ) {
    const isStaff = this.isStaff(req?.user);
    return this.forumService.getCategories(cohortId, verticalId, isStaff);
  }

  @Get("categories/:id")
  @ApiOperation({ summary: "Get a forum category by ID" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiResponse({ status: 200, description: "Category details" })
  @ApiResponse({ status: 404, description: "Category not found" })
  async getCategory(@Param("id") id: string) {
    return this.forumService.findCategoryById(id);
  }

  // ============ Threads ============

  @Get("categories/:categoryId/threads")
  @ApiOperation({ summary: "Get threads in a category" })
  @ApiParam({ name: "categoryId", description: "Category ID" })
  @ApiResponse({ status: 200, description: "List of threads" })
  async getThreads(
    @Param("categoryId") categoryId: string,
    @Query() query: ThreadQueryDto
  ) {
    return this.forumService.getThreads(categoryId, query);
  }

  @Post("threads")
  @ApiOperation({ summary: "Create a new forum thread" })
  @ApiResponse({ status: 201, description: "Thread created" })
  @ApiResponse({ status: 400, description: "Validation error" })
  async createThread(@Body() dto: CreateThreadDto, @Request() req: any) {
    const author = this.getAuthorInfo(req.user);
    return this.forumService.createThread(dto, author);
  }

  @Get("threads/:id")
  @ApiOperation({ summary: "Get a thread with replies" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread with replies" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async getThread(@Param("id") id: string, @Request() req: any) {
    const viewer = this.getAuthorInfo(req.user);
    return this.forumService.getThreadDetail(id, viewer);
  }

  @Patch("threads/:id")
  @ApiOperation({ summary: "Update a thread (author only)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread updated" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async updateThread(
    @Param("id") id: string,
    @Body() dto: UpdateThreadDto,
    @Request() req: any
  ) {
    const author = this.getAuthorInfo(req.user);
    return this.forumService.updateThread(id, dto, author);
  }

  @Delete("threads/:id")
  @ApiOperation({ summary: "Delete a thread (author only)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread deleted" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async deleteThread(@Param("id") id: string, @Request() req: any) {
    const author = this.getAuthorInfo(req.user);
    await this.forumService.deleteThread(id, author);
    return { success: true };
  }

  // ============ Replies ============

  @Post("threads/:threadId/replies")
  @ApiOperation({ summary: "Reply to a thread" })
  @ApiParam({ name: "threadId", description: "Thread ID" })
  @ApiResponse({ status: 201, description: "Reply created" })
  @ApiResponse({ status: 400, description: "Thread is locked" })
  async createReply(
    @Param("threadId") threadId: string,
    @Body() dto: CreateReplyDto,
    @Request() req: any
  ) {
    const author = this.getAuthorInfo(req.user);
    return this.forumService.createReply(threadId, dto, author);
  }

  @Patch("replies/:id")
  @ApiOperation({ summary: "Update a reply (author only)" })
  @ApiParam({ name: "id", description: "Reply ID" })
  @ApiResponse({ status: 200, description: "Reply updated" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async updateReply(
    @Param("id") id: string,
    @Body() dto: UpdateReplyDto,
    @Request() req: any
  ) {
    const author = this.getAuthorInfo(req.user);
    return this.forumService.updateReply(id, dto, author);
  }

  @Delete("replies/:id")
  @ApiOperation({ summary: "Delete a reply (author only)" })
  @ApiParam({ name: "id", description: "Reply ID" })
  @ApiResponse({ status: 200, description: "Reply deleted" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async deleteReply(@Param("id") id: string, @Request() req: any) {
    const author = this.getAuthorInfo(req.user);
    await this.forumService.deleteReply(id, author);
    return { success: true };
  }

  @Post("threads/:threadId/replies/:replyId/solution")
  @ApiOperation({ summary: "Mark a reply as the solution (thread author only)" })
  @ApiParam({ name: "threadId", description: "Thread ID" })
  @ApiParam({ name: "replyId", description: "Reply ID" })
  @ApiResponse({ status: 200, description: "Reply marked as solution" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async markAsSolution(
    @Param("threadId") threadId: string,
    @Param("replyId") replyId: string,
    @Request() req: any
  ) {
    const author = this.getAuthorInfo(req.user);
    return this.forumService.markAsSolution(replyId, threadId, author);
  }

  // ============ Helpers ============

  private getAuthorInfo(user: any): AuthorInfo {
    // Determine author type based on user role
    let authorType: ForumAuthorType;
    let authorId: string;
    let authorName: string;
    let authorAvatarUrl: string | undefined;

    if (user.role === "participant") {
      authorType = ForumAuthorType.PARTICIPANT;
      authorId = user.participantId || user.id;
      authorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
      authorAvatarUrl = user.avatarUrl;
    } else if (user.role === "mentor") {
      authorType = ForumAuthorType.MENTOR;
      authorId = user.mentorId || user.id;
      authorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
      authorAvatarUrl = user.profileImageUrl || user.avatarUrl;
    } else {
      authorType = ForumAuthorType.STAFF;
      authorId = user.id;
      authorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
      authorAvatarUrl = user.avatarUrl;
    }

    return {
      id: authorId,
      type: authorType,
      name: authorName,
      avatarUrl: authorAvatarUrl,
    };
  }

  private isStaff(user: any): boolean {
    if (!user) return false;
    return ["super_admin", "program_manager", "evaluator", "viewer"].includes(
      user.role
    );
  }
}

/**
 * Admin Forum API - for staff to manage categories, pin/lock threads
 */
@ApiTags("forum-admin")
@Controller("admin/forum")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminForumController {
  constructor(private readonly forumService: ForumService) {}

  // ============ Category Management ============

  @Post("categories")
  @ApiOperation({ summary: "Create a forum category" })
  @ApiResponse({ status: 201, description: "Category created" })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.forumService.createCategory(dto);
  }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Update a forum category" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiResponse({ status: 200, description: "Category updated" })
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.forumService.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @ApiOperation({ summary: "Delete a forum category" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiResponse({ status: 200, description: "Category deleted" })
  async deleteCategory(@Param("id") id: string) {
    await this.forumService.deleteCategory(id);
    return { success: true };
  }

  // ============ Thread Management ============

  @Patch("threads/:id/pin")
  @ApiOperation({ summary: "Pin or unpin a thread" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread pin status updated" })
  async pinThread(
    @Param("id") id: string,
    @Body("isPinned") isPinned: boolean
  ) {
    return this.forumService.pinThread(id, isPinned);
  }

  @Patch("threads/:id/lock")
  @ApiOperation({ summary: "Lock or unlock a thread" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread lock status updated" })
  async lockThread(
    @Param("id") id: string,
    @Body("isLocked") isLocked: boolean
  ) {
    return this.forumService.lockThread(id, isLocked);
  }

  @Delete("threads/:id")
  @ApiOperation({ summary: "Delete a thread (admin)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread deleted" })
  async deleteThread(@Param("id") id: string, @Request() req: any) {
    const author: AuthorInfo = {
      id: req.user.id,
      type: ForumAuthorType.STAFF,
      name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
    };
    await this.forumService.deleteThread(id, author);
    return { success: true };
  }

  @Delete("replies/:id")
  @ApiOperation({ summary: "Delete a reply (admin)" })
  @ApiParam({ name: "id", description: "Reply ID" })
  @ApiResponse({ status: 200, description: "Reply deleted" })
  async deleteReply(@Param("id") id: string, @Request() req: any) {
    const author: AuthorInfo = {
      id: req.user.id,
      type: ForumAuthorType.STAFF,
      name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
    };
    await this.forumService.deleteReply(id, author);
    return { success: true };
  }
}
