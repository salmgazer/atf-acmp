import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
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
  ApiQuery,
  ApiConsumes,
} from "@nestjs/swagger";
import { BriefsService } from "./briefs.service";
import {
  CreateBriefDto,
  UpdateBriefDto,
  SubmitBriefDto,
  ReviewBriefDto,
  BriefQueryDto,
  StaffUpdateBriefDto,
  RestoreRevisionDto,
} from "./dto/brief.dto";
import { UploadService } from "@/common/services/upload.service";
import { VerticalsService } from "../verticals/verticals.service";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@ApiTags("briefs")
@Controller("briefs")
@UseInterceptors(AuditInterceptor)
@ApiBearerAuth()
export class BriefsController {
  constructor(
    private readonly briefsService: BriefsService,
    private readonly uploadService: UploadService,
    private readonly verticalsService: VerticalsService,
  ) {}

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Created brief: ${result?.title}`,
  })
  @ApiOperation({ summary: "Create a new brief (organization problem statement)" })
  @ApiResponse({ status: 201, description: "Brief created successfully" })
  @ApiResponse({ status: 400, description: "Validation error" })
  create(@Body() dto: CreateBriefDto) {
    return this.briefsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all briefs with pagination and filters" })
  @ApiResponse({ status: 200, description: "List of briefs" })
  findAll(@Query() query: BriefQueryDto) {
    return this.briefsService.findAll(query);
  }

  @Get("approved")
  @ApiOperation({ summary: "Get approved briefs for a cohort" })
  @ApiQuery({ name: "cohortId", required: true, description: "Cohort ID" })
  @ApiQuery({ name: "verticalId", required: false, description: "Filter by vertical" })
  @ApiQuery({ name: "search", required: false, description: "Search by title, organization, or tags" })
  @ApiResponse({ status: 200, description: "List of approved briefs" })
  findApproved(
    @Query("cohortId") cohortId: string,
    @Query("verticalId") verticalId?: string,
    @Query("search") search?: string
  ) {
    return this.briefsService.findApproved(cohortId, verticalId, search);
  }

  @Get("verticals/:cohortId")
  @ApiOperation({ summary: "Get verticals for a cohort (participant accessible)" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiResponse({ status: 200, description: "List of active verticals" })
  getVerticals(@Param("cohortId") cohortId: string) {
    return this.verticalsService.findByCohort(cohortId);
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get brief statistics" })
  @ApiQuery({ name: "cohortId", required: false, description: "Filter by cohort" })
  @ApiResponse({ status: 200, description: "Brief statistics" })
  getStatistics(@Query("cohortId") cohortId?: string) {
    return this.briefsService.getStatistics(cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a brief by ID" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Brief details" })
  @ApiResponse({ status: 404, description: "Brief not found" })
  findOne(@Param("id") id: string) {
    return this.briefsService.findOne(id);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Updated brief: ${result?.title}`,
  })
  @ApiOperation({ summary: "Update a brief" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Brief updated" })
  @ApiResponse({ status: 404, description: "Brief not found" })
  update(@Param("id") id: string, @Body() dto: UpdateBriefDto) {
    return this.briefsService.update(id, dto);
  }

  @Patch(":id/staff")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Staff updated brief: ${result?.title}`,
  })
  @ApiOperation({ summary: "Staff update a brief (bypasses status restrictions)" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiQuery({ name: "actorId", required: true, description: "Staff user ID" })
  @ApiQuery({ name: "actorName", required: true, description: "Staff user name" })
  @ApiResponse({ status: 200, description: "Brief updated by staff" })
  @ApiResponse({ status: 404, description: "Brief not found" })
  staffUpdate(
    @Param("id") id: string,
    @Body() dto: StaffUpdateBriefDto,
    @Query("actorId") actorId: string,
    @Query("actorName") actorName: string,
  ) {
    return this.briefsService.staffUpdate(id, dto, actorId, actorName);
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Submitted brief for review: ${result?.title}`,
  })
  @ApiOperation({ summary: "Submit a brief for review" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Brief submitted for review" })
  @ApiResponse({ status: 400, description: "Brief cannot be submitted" })
  submit(@Param("id") id: string, @Body() dto: SubmitBriefDto) {
    return this.briefsService.submit(id, dto);
  }

  @Post(":id/start-review")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Started review of brief: ${result?.title}`,
  })
  @ApiOperation({ summary: "Start reviewing a brief" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiQuery({ name: "reviewerId", required: false, description: "Reviewer user ID" })
  @ApiResponse({ status: 200, description: "Review started" })
  startReview(
    @Param("id") id: string,
    @Query("reviewerId") reviewerId?: string
  ) {
    return this.briefsService.startReview(id, reviewerId);
  }

  @Post(":id/review")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Reviewed brief: ${result?.title} (${result?.status})`,
  })
  @ApiOperation({ summary: "Complete review of a brief (approve/reject/request changes)" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Review completed" })
  @ApiResponse({ status: 400, description: "Invalid review decision" })
  review(@Param("id") id: string, @Body() dto: ReviewBriefDto) {
    return this.briefsService.review(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: AuditAction.DELETE,
    entityType: "Brief",
    getEntityId: (_, args) => args[0]?.id,
    getDescription: (_, args) => `Deleted brief: ${args[0]?.id}`,
  })
  @ApiOperation({ summary: "Delete a brief (draft only)" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 204, description: "Brief deleted" })
  @ApiResponse({ status: 400, description: "Cannot delete non-draft brief" })
  delete(@Param("id") id: string) {
    return this.briefsService.delete(id);
  }

  @Get(":id/revisions")
  @ApiOperation({ summary: "Get revision history for a brief" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "List of revisions" })
  getRevisionHistory(@Param("id") id: string) {
    return this.briefsService.getRevisionHistory(id);
  }

  @Get(":id/revisions/:revisionId")
  @ApiOperation({ summary: "Get a single revision by ID" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiParam({ name: "revisionId", description: "Revision ID" })
  @ApiResponse({ status: 200, description: "Revision details" })
  @ApiResponse({ status: 404, description: "Revision not found" })
  getRevision(
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
  ) {
    return this.briefsService.getRevision(id, revisionId);
  }

  @Post(":id/revisions/:revisionId/restore")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Brief",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.title,
    getDescription: (result) => `Restored brief to previous revision: ${result?.title}`,
  })
  @ApiOperation({ summary: "Restore brief to a previous revision" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiParam({ name: "revisionId", description: "Revision ID to restore" })
  @ApiQuery({ name: "actorId", required: true, description: "Staff user ID" })
  @ApiQuery({ name: "actorName", required: true, description: "Staff user name" })
  @ApiResponse({ status: 200, description: "Brief restored to previous revision" })
  @ApiResponse({ status: 404, description: "Brief or revision not found" })
  @ApiResponse({ status: 400, description: "Revision cannot be restored" })
  restoreRevision(
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
    @Query("actorId") actorId: string,
    @Query("actorName") actorName: string,
    @Body() dto: RestoreRevisionDto,
  ) {
    return this.briefsService.restoreRevision(id, revisionId, actorId, actorName, dto.comment);
  }

  @Post(":id/upload-video")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a video for a brief (Stage B - after approval)" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Video uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file or brief not approved" })
  async uploadVideo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Upload the video (with thumbnail generation)
    const result = await this.uploadService.uploadBriefVideo(file, id);

    // Update the brief with the video URL and thumbnail URL
    await this.briefsService.updateVideoUrl(id, result.url, result.thumbnailUrl);

    return { 
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
    };
  }

  @Post(":id/upload-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload an image for a brief gallery (Stage B - after approval)" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Image uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file or brief not approved" })
  async uploadImage(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Upload the image
    const result = await this.uploadService.uploadBriefResourceImage(file);

    // Add to the brief's image gallery
    const brief = await this.briefsService.addImage(id, result.url);

    return { 
      url: result.url,
      imageUrls: brief.imageUrls,
    };
  }

  @Delete(":id/images/:index")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove an image from a brief gallery (Stage B)" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiParam({ name: "index", description: "Image index to remove (0-based)" })
  @ApiResponse({ status: 200, description: "Image removed successfully" })
  @ApiResponse({ status: 400, description: "Invalid index or brief not approved" })
  async removeImage(
    @Param("id") id: string,
    @Param("index") index: string,
  ) {
    const imageIndex = parseInt(index, 10);
    if (isNaN(imageIndex)) {
      throw new BadRequestException("Invalid image index");
    }

    const brief = await this.briefsService.removeImage(id, imageIndex);

    return { 
      imageUrls: brief.imageUrls,
    };
  }

  @Post("upload-video")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a video for a new brief (before creation)" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Video uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  async uploadVideoForNew(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Upload the video (with thumbnail generation)
    const result = await this.uploadService.uploadBriefVideo(file);

    return { 
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
    };
  }

  @Post("upload-resource")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a resource document for a brief" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Document uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  async uploadResource(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const result = await this.uploadService.uploadBriefResource(file);

    return { 
      url: result.url,
      name: file.originalname,
    };
  }

  @Post("upload-resource-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a resource image for a brief (PNG, JPG, JPEG)" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Image uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  async uploadResourceImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const result = await this.uploadService.uploadBriefResourceImage(file);

    return { 
      url: result.url,
      name: file.originalname,
    };
  }

  @Post("upload-resource-video")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a resource video for a brief (MP4 only)" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Video uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  async uploadResourceVideo(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const result = await this.uploadService.uploadBriefResourceVideo(file);

    return { 
      url: result.url,
      name: file.originalname,
    };
  }
}
