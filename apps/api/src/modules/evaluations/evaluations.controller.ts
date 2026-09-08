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
import { EvaluationsService } from "./evaluations.service";
import {
  TriggerEvaluationDto,
  TriggerSingleEvaluationDto,
  EvaluationQueryDto,
  JobQueryDto,
  SubmitHumanScoreDto,
  UpdateAIWeightDto,
  PublishEvaluationsDto,
} from "./dto/evaluation.dto";

@ApiTags("evaluations-admin")
@Controller("admin/evaluations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  // ============ Trigger Endpoints ============

  @Post("trigger")
  @ApiOperation({ summary: "Trigger batch AI evaluation for a cohort stage" })
  @ApiResponse({ status: 201, description: "Batch evaluation triggered" })
  @ApiResponse({ status: 400, description: "Invalid parameters" })
  async triggerBatchEvaluation(@Body() dto: TriggerEvaluationDto) {
    return this.evaluationsService.triggerBatchEvaluation(dto);
  }

  @Post("trigger/single")
  @ApiOperation({ summary: "Trigger AI evaluation for a single submission" })
  @ApiResponse({ status: 201, description: "Evaluation triggered" })
  @ApiResponse({ status: 404, description: "Submission not found" })
  async triggerSingleEvaluation(@Body() dto: TriggerSingleEvaluationDto) {
    return this.evaluationsService.triggerSingleEvaluation(dto);
  }

  // ============ Queue Management ============

  @Get("queue/status")
  @ApiOperation({ summary: "Get evaluation queue status" })
  @ApiResponse({ status: 200, description: "Queue status" })
  async getQueueStatus() {
    return this.evaluationsService.getQueueStatus();
  }

  @Post("queue/pause")
  @ApiOperation({ summary: "Pause the evaluation queue" })
  @ApiResponse({ status: 200, description: "Queue paused" })
  async pauseQueue() {
    await this.evaluationsService.pauseQueue();
    return { message: "Queue paused" };
  }

  @Post("queue/resume")
  @ApiOperation({ summary: "Resume the evaluation queue" })
  @ApiResponse({ status: 200, description: "Queue resumed" })
  async resumeQueue() {
    await this.evaluationsService.resumeQueue();
    return { message: "Queue resumed" };
  }

  @Delete("queue/clear")
  @ApiOperation({ summary: "Clear all pending jobs from the queue" })
  @ApiResponse({ status: 200, description: "Queue cleared" })
  async clearQueue() {
    const count = await this.evaluationsService.clearQueue();
    return { message: `Cleared ${count} jobs from queue` };
  }

  // ============ Job Management ============

  @Get("jobs")
  @ApiOperation({ summary: "Get evaluation jobs with filters" })
  @ApiResponse({ status: 200, description: "List of jobs" })
  async getJobs(@Query() query: JobQueryDto) {
    return this.evaluationsService.getJobs(query);
  }

  @Get("jobs/:id")
  @ApiOperation({ summary: "Get a specific evaluation job" })
  @ApiParam({ name: "id", description: "Job ID" })
  @ApiResponse({ status: 200, description: "Job details" })
  @ApiResponse({ status: 404, description: "Job not found" })
  async getJob(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationsService.getJob(id);
  }

  @Post("jobs/:id/retry")
  @ApiOperation({ summary: "Retry a failed evaluation job" })
  @ApiParam({ name: "id", description: "Job ID" })
  @ApiResponse({ status: 200, description: "Job retried" })
  async retryJob(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationsService.retryFailedJob(id);
  }

  @Post("jobs/:id/cancel")
  @ApiOperation({ summary: "Cancel a pending evaluation job" })
  @ApiParam({ name: "id", description: "Job ID" })
  @ApiResponse({ status: 200, description: "Job cancelled" })
  async cancelJob(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationsService.cancelJob(id);
  }

  // ============ Evaluation Results ============

  @Get()
  @ApiOperation({ summary: "Get evaluations with filters" })
  @ApiResponse({ status: 200, description: "List of evaluations" })
  async getEvaluations(@Query() query: EvaluationQueryDto) {
    return this.evaluationsService.getEvaluations(query);
  }

  @Get("stats/:cohortId/:stageId")
  @ApiOperation({ summary: "Get statistics for a cohort stage evaluations" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiParam({ name: "stageId", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Stage statistics" })
  async getStageStats(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("stageId", ParseUUIDPipe) stageId: string,
  ) {
    return this.evaluationsService.getStageStats(cohortId, stageId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific evaluation" })
  @ApiParam({ name: "id", description: "Evaluation ID" })
  @ApiResponse({ status: 200, description: "Evaluation details" })
  @ApiResponse({ status: 404, description: "Evaluation not found" })
  async getEvaluation(@Param("id", ParseUUIDPipe) id: string) {
    return this.evaluationsService.getEvaluation(id);
  }

  // ============ Human Scoring ============

  @Post(":id/human-score")
  @ApiOperation({ summary: "Submit human evaluator score for an evaluation" })
  @ApiParam({ name: "id", description: "Evaluation ID" })
  @ApiResponse({ status: 200, description: "Human score submitted" })
  async submitHumanScore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitHumanScoreDto,
    @CurrentUser("id") evaluatorId: string,
  ) {
    return this.evaluationsService.submitHumanScore(id, dto, evaluatorId);
  }

  @Patch(":id/ai-weight")
  @ApiOperation({ summary: "Update AI score weight for an evaluation" })
  @ApiParam({ name: "id", description: "Evaluation ID" })
  @ApiResponse({ status: 200, description: "AI weight updated" })
  async updateAIWeight(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAIWeightDto,
  ) {
    return this.evaluationsService.updateAIWeight(id, dto.aiWeight);
  }

  // ============ Publishing ============

  @Post("publish")
  @ApiOperation({ summary: "Publish evaluations to make them visible to teams" })
  @ApiResponse({ status: 200, description: "Evaluations published" })
  async publishEvaluations(@Body() dto: PublishEvaluationsDto) {
    const count = await this.evaluationsService.publishEvaluations(dto.evaluationIds);
    return { message: `Published ${count} evaluations` };
  }

  @Post("unpublish")
  @ApiOperation({ summary: "Unpublish evaluations" })
  @ApiResponse({ status: 200, description: "Evaluations unpublished" })
  async unpublishEvaluations(@Body() dto: PublishEvaluationsDto) {
    const count = await this.evaluationsService.unpublishEvaluations(dto.evaluationIds);
    return { message: `Unpublished ${count} evaluations` };
  }
}

// Participant-facing controller for viewing their evaluations
@ApiTags("evaluations")
@Controller("evaluations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ParticipantEvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get("my/:stageId")
  @ApiOperation({ summary: "Get my team evaluation for a specific stage" })
  @ApiParam({ name: "stageId", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Team evaluation (if published)" })
  async getMyEvaluation(
    @Param("stageId", ParseUUIDPipe) stageId: string,
    @CurrentUser("teamId") teamId: string,
  ) {
    if (!teamId) {
      return null;
    }

    const evaluation = await this.evaluationsService.getEvaluationForTeam(teamId, stageId);
    
    // Only return if published
    if (!evaluation || !evaluation.isPublished) {
      return null;
    }

    return evaluation;
  }
}
