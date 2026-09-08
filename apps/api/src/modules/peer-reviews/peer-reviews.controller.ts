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
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/database/entities/user.entity";
import { PeerReviewsService } from "./peer-reviews.service";
import {
  CreateRubricDto,
  UpdateRubricDto,
  AssignPeerReviewsDto,
  SubmitPeerReviewDto,
  PeerReviewQueryDto,
  FlagReviewDto,
} from "./dto/peer-review.dto";

// ============ Participant Controller ============

@ApiTags("peer-reviews")
@Controller("peer-reviews")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PeerReviewsController {
  constructor(private readonly peerReviewsService: PeerReviewsService) {}

  @Get("my/assigned")
  @ApiOperation({ summary: "Get peer reviews assigned to me" })
  @ApiResponse({ status: 200, description: "List of assigned reviews" })
  async getMyAssignedReviews(@CurrentUser("participantId") participantId: string) {
    return this.peerReviewsService.getMyAssignedReviews(participantId);
  }

  @Get("my/received")
  @ApiOperation({ summary: "Get peer reviews received by my team" })
  @ApiResponse({ status: 200, description: "List of received reviews" })
  async getMyReceivedReviews(@CurrentUser("participantId") participantId: string) {
    return this.peerReviewsService.getMyReceivedReviews(participantId);
  }

  @Get("assignments/:id")
  @ApiOperation({ summary: "Get a specific assignment and start tracking" })
  @ApiParam({ name: "id", description: "Assignment ID" })
  @ApiResponse({ status: 200, description: "Assignment details" })
  @ApiResponse({ status: 404, description: "Assignment not found" })
  async getAssignment(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("participantId") participantId: string,
  ) {
    // Start tracking when participant views assignment
    return this.peerReviewsService.startReview(participantId, id);
  }

  @Get("rubric/:cohortId/:stageId")
  @ApiOperation({ summary: "Get the rubric for a stage" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiParam({ name: "stageId", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Rubric for the stage" })
  async getRubricForStage(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("stageId", ParseUUIDPipe) stageId: string,
  ) {
    return this.peerReviewsService.getRubricForStage(cohortId, stageId);
  }

  @Post()
  @ApiOperation({ summary: "Submit a peer review" })
  @ApiResponse({ status: 201, description: "Peer review submitted" })
  @ApiResponse({ status: 400, description: "Invalid review or deadline passed" })
  async submitReview(
    @CurrentUser("participantId") participantId: string,
    @Body() dto: SubmitPeerReviewDto,
  ) {
    return this.peerReviewsService.submitReview(participantId, dto);
  }
}

// ============ Admin Controller ============

@ApiTags("peer-reviews-admin")
@Controller("admin/peer-reviews")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminPeerReviewsController {
  constructor(private readonly peerReviewsService: PeerReviewsService) {}

  // ============ Rubric Management ============

  @Post("rubrics")
  @ApiOperation({ summary: "Create a peer review rubric" })
  @ApiResponse({ status: 201, description: "Rubric created" })
  async createRubric(@Body() dto: CreateRubricDto) {
    return this.peerReviewsService.createRubric(dto);
  }

  @Get("rubrics/cohort/:cohortId")
  @ApiOperation({ summary: "Get all rubrics for a cohort" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "List of rubrics" })
  async getRubrics(@Param("cohortId", ParseUUIDPipe) cohortId: string) {
    return this.peerReviewsService.getRubrics(cohortId);
  }

  @Get("rubrics/:id")
  @ApiOperation({ summary: "Get a rubric by ID" })
  @ApiParam({ name: "id", description: "Rubric ID" })
  @ApiResponse({ status: 200, description: "Rubric details" })
  async getRubric(@Param("id", ParseUUIDPipe) id: string) {
    return this.peerReviewsService.getRubric(id);
  }

  @Patch("rubrics/:id")
  @ApiOperation({ summary: "Update a rubric" })
  @ApiParam({ name: "id", description: "Rubric ID" })
  @ApiResponse({ status: 200, description: "Rubric updated" })
  async updateRubric(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRubricDto,
  ) {
    return this.peerReviewsService.updateRubric(id, dto);
  }

  @Delete("rubrics/:id")
  @ApiOperation({ summary: "Delete a rubric" })
  @ApiParam({ name: "id", description: "Rubric ID" })
  @ApiResponse({ status: 200, description: "Rubric deleted" })
  async deleteRubric(@Param("id", ParseUUIDPipe) id: string) {
    await this.peerReviewsService.deleteRubric(id);
    return { message: "Rubric deleted" };
  }

  // ============ Assignment Management ============

  @Post("assign")
  @ApiOperation({ summary: "Assign peer reviews for a stage" })
  @ApiResponse({ status: 201, description: "Peer reviews assigned" })
  async assignPeerReviews(@Body() dto: AssignPeerReviewsDto) {
    return this.peerReviewsService.assignPeerReviews(dto);
  }

  @Get("assignments")
  @ApiOperation({ summary: "Get peer review assignments with filters" })
  @ApiResponse({ status: 200, description: "Paginated assignments" })
  async getAssignments(@Query() query: PeerReviewQueryDto) {
    return this.peerReviewsService.getAssignments(query);
  }

  @Get("assignments/:id")
  @ApiOperation({ summary: "Get an assignment by ID" })
  @ApiParam({ name: "id", description: "Assignment ID" })
  @ApiResponse({ status: 200, description: "Assignment details" })
  async getAssignment(@Param("id", ParseUUIDPipe) id: string) {
    return this.peerReviewsService.getAssignment(id);
  }

  @Patch("assignments/:id/skip")
  @ApiOperation({ summary: "Skip an assignment (mark as not required)" })
  @ApiParam({ name: "id", description: "Assignment ID" })
  @ApiResponse({ status: 200, description: "Assignment skipped" })
  async skipAssignment(@Param("id", ParseUUIDPipe) id: string) {
    return this.peerReviewsService.skipAssignment(id);
  }

  @Delete("assignments/stage/:cohortId/:stageId")
  @ApiOperation({ summary: "Delete all assignments for a stage" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiParam({ name: "stageId", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Assignments deleted" })
  async deleteAssignmentsForStage(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("stageId", ParseUUIDPipe) stageId: string,
  ) {
    const count = await this.peerReviewsService.deleteAssignmentsForStage(cohortId, stageId);
    return { message: `Deleted ${count} assignments` };
  }

  // ============ Review Management ============

  @Get("reviews")
  @ApiOperation({ summary: "Get submitted reviews with filters" })
  @ApiResponse({ status: 200, description: "Paginated reviews" })
  async getReviews(@Query() query: PeerReviewQueryDto) {
    return this.peerReviewsService.getReviews(query);
  }

  @Get("reviews/:id")
  @ApiOperation({ summary: "Get a review by ID" })
  @ApiParam({ name: "id", description: "Review ID" })
  @ApiResponse({ status: 200, description: "Review details" })
  async getReviewById(@Param("id", ParseUUIDPipe) id: string) {
    return this.peerReviewsService.getReviewById(id);
  }

  @Patch("reviews/:id/flag")
  @ApiOperation({ summary: "Flag a review for moderation" })
  @ApiParam({ name: "id", description: "Review ID" })
  @ApiResponse({ status: 200, description: "Review flagged" })
  async flagReview(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: FlagReviewDto,
  ) {
    return this.peerReviewsService.flagReview(id, dto.reason);
  }

  @Patch("reviews/:id/unflag")
  @ApiOperation({ summary: "Remove flag from a review" })
  @ApiParam({ name: "id", description: "Review ID" })
  @ApiResponse({ status: 200, description: "Review unflagged" })
  async unflagReview(@Param("id", ParseUUIDPipe) id: string) {
    return this.peerReviewsService.unflagReview(id);
  }

  // ============ Stats ============

  @Get("stats/stage/:cohortId/:stageId")
  @ApiOperation({ summary: "Get peer review statistics for a stage" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiParam({ name: "stageId", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Stage statistics" })
  async getStageStats(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("stageId", ParseUUIDPipe) stageId: string,
  ) {
    return this.peerReviewsService.getStageStats(cohortId, stageId);
  }

  @Get("stats/team/:teamId")
  @ApiOperation({ summary: "Get peer review summary for a team" })
  @ApiParam({ name: "teamId", description: "Team ID" })
  @ApiResponse({ status: 200, description: "Team review summary" })
  async getTeamReviewSummary(@Param("teamId", ParseUUIDPipe) teamId: string) {
    return this.peerReviewsService.getTeamReviewSummary(teamId);
  }
}
