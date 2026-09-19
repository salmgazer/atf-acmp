import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { SubmissionsService } from "./submissions.service";
import { UploadService } from "@/common/services/upload.service";
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
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@ApiTags("stages")
@Controller("stages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StagesController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @ApiOperation({ summary: "Get all stages for a cohort" })
  @ApiResponse({ status: 200, description: "List of stages" })
  async getStages(@Query() query: StageQueryDto) {
    const stages = await this.submissionsService.getStages(query);
    return stages.map((stage) => ({
      ...stage,
      isOpen: stage.isOpen(),
      isPastDeadline: stage.isPastDeadline(),
    }));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a stage by ID" })
  @ApiParam({ name: "id", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Stage details" })
  @ApiResponse({ status: 404, description: "Stage not found" })
  async getStage(@Param("id", ParseUUIDPipe) id: string) {
    const stage = await this.submissionsService.getStage(id);
    return {
      ...stage,
      isOpen: stage.isOpen(),
      isPastDeadline: stage.isPastDeadline(),
    };
  }
}

@ApiTags("submissions")
@Controller("submissions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly uploadService: UploadService,
  ) {}

  @Get("my")
  @ApiOperation({ summary: "Get my team submissions" })
  @ApiResponse({ status: 200, description: "List of team submissions" })
  async getMySubmissions(@Request() req: any) {
    const participantId = req.user.participantId;
    if (!participantId) {
      return [];
    }
    return this.submissionsService.getTeamSubmissions(participantId);
  }

  @Get("my/stage/:stageId")
  @ApiOperation({ summary: "Get my team submission for a specific stage" })
  @ApiParam({ name: "stageId", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Submission for the stage" })
  async getMySubmissionForStage(
    @Request() req: any,
    @Param("stageId", ParseUUIDPipe) stageId: string,
  ) {
    const participantId = req.user.participantId;
    if (!participantId) {
      return null;
    }
    return this.submissionsService.getTeamSubmissionForStage(participantId, stageId);
  }

  @Post("draft")
  @ApiOperation({ summary: "Save submission as draft" })
  @ApiResponse({ status: 201, description: "Draft saved" })
  async saveDraft(@Request() req: any, @Body() dto: SaveSubmissionDraftDto) {
    const participantId = req.user.participantId;
    return this.submissionsService.saveDraft(participantId, dto);
  }

  @Post("submit")
  @ApiOperation({ summary: "Submit final submission" })
  @ApiResponse({ status: 201, description: "Submission completed" })
  @ApiResponse({ status: 400, description: "Stage closed or deadline passed" })
  async submit(@Request() req: any, @Body() dto: SubmitSubmissionDto) {
    const participantId = req.user.participantId;
    return this.submissionsService.submit(participantId, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a submission by ID" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission details" })
  async getSubmission(@Param("id", ParseUUIDPipe) id: string) {
    return this.submissionsService.getSubmission(id);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Get submission version history" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission history" })
  async getSubmissionHistory(@Param("id", ParseUUIDPipe) id: string) {
    return this.submissionsService.getSubmissionHistory(id);
  }

  @Post("upload-video")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a video for a submission" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Video uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Upload the video to S3 (with thumbnail generation)
    const result = await this.uploadService.uploadVideo(
      file,
      "submissions/videos",
      true, // Generate thumbnail
    );

    return {
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
    };
  }
}

@ApiTags("stages-admin")
@Controller("admin/stages")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminStagesController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Stage",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Created stage: ${result?.name}`,
  })
  @ApiOperation({ summary: "Create a new stage" })
  @ApiResponse({ status: 201, description: "Stage created" })
  async createStage(@Body() dto: CreateStageDto) {
    return this.submissionsService.createStage(dto);
  }

  @Put(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Stage",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Updated stage: ${result?.name}`,
  })
  @ApiOperation({ summary: "Update a stage" })
  @ApiParam({ name: "id", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Stage updated" })
  async updateStage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.submissionsService.updateStage(id, dto);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Stage",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Updated stage: ${result?.name}`,
  })
  @ApiOperation({ summary: "Partially update a stage" })
  @ApiParam({ name: "id", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Stage updated" })
  async patchStage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.submissionsService.updateStage(id, dto);
  }

  @Delete(":id")
  @Audit({
    action: AuditAction.DELETE,
    entityType: "Stage",
    getEntityId: (_, args) => args[0]?.id,
    getDescription: (_, args) => `Deleted stage: ${args[0]?.id}`,
  })
  @ApiOperation({ summary: "Delete a stage" })
  @ApiParam({ name: "id", description: "Stage ID" })
  @ApiResponse({ status: 200, description: "Stage deleted" })
  async deleteStage(@Param("id", ParseUUIDPipe) id: string) {
    await this.submissionsService.deleteStage(id);
    return { success: true };
  }

  @Get("cohort/:cohortId/stats")
  @ApiOperation({ summary: "Get stages with submission statistics" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Stages with stats" })
  async getStagesWithStats(@Param("cohortId", ParseUUIDPipe) cohortId: string) {
    return this.submissionsService.getStagesWithStats(cohortId);
  }
}

@ApiTags("submissions-admin")
@Controller("admin/submissions")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminSubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @ApiOperation({ summary: "Get all submissions with filters" })
  @ApiResponse({ status: 200, description: "Paginated submissions" })
  async getSubmissions(@Query() query: SubmissionQueryDto) {
    return this.submissionsService.getSubmissions(query);
  }

  @Get("pending-approval")
  @ApiOperation({ summary: "Get submissions pending approval" })
  @ApiResponse({ status: 200, description: "Submissions needing approval" })
  async getPendingApprovalSubmissions(@Query() query: SubmissionApprovalQueryDto) {
    return this.submissionsService.getPendingApprovalSubmissions(query);
  }

  @Get("stats/:cohortId")
  @ApiOperation({ summary: "Get submission statistics for a cohort" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "Submission statistics" })
  async getSubmissionStats(@Param("cohortId", ParseUUIDPipe) cohortId: string) {
    return this.submissionsService.getSubmissionStats(cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a submission by ID (admin)" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission details" })
  async getSubmission(@Param("id", ParseUUIDPipe) id: string) {
    return this.submissionsService.getSubmission(id);
  }

  @Post(":id/approve")
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Submission",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Approved submission: ${result?.id}`,
  })
  @ApiOperation({ summary: "Approve a submission" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission approved" })
  @ApiResponse({ status: 400, description: "Submission not pending approval" })
  async approveSubmission(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: ApproveSubmissionDto,
  ) {
    return this.submissionsService.approveSubmission(id, req.user.id, dto);
  }

  @Post(":id/reject")
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Submission",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Rejected submission: ${result?.id}`,
  })
  @ApiOperation({ summary: "Reject a submission" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission rejected" })
  @ApiResponse({ status: 400, description: "Submission not pending approval" })
  async rejectSubmission(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: RejectSubmissionDto,
  ) {
    return this.submissionsService.rejectSubmission(id, req.user.id, dto);
  }

  @Post(":id/evaluate")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Submission",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Evaluated submission: ${result?.id}`,
  })
  @ApiOperation({ summary: "Evaluate a submission" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Evaluation saved" })
  async evaluateSubmission(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: EvaluateSubmissionDto,
  ) {
    return this.submissionsService.evaluateSubmission(id, req.user.id, dto);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Get submission version history (admin)" })
  @ApiParam({ name: "id", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission history" })
  async getSubmissionHistory(@Param("id", ParseUUIDPipe) id: string) {
    return this.submissionsService.getSubmissionHistory(id);
  }
}
