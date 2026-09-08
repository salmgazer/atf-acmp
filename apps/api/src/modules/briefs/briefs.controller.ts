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
} from "./dto/brief.dto";
import { UploadService } from "@/common/services/upload.service";
import { VerticalsService } from "../verticals/verticals.service";

@ApiTags("briefs")
@Controller("briefs")
@ApiBearerAuth()
export class BriefsController {
  constructor(
    private readonly briefsService: BriefsService,
    private readonly uploadService: UploadService,
    private readonly verticalsService: VerticalsService,
  ) {}

  @Post()
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
  @ApiOperation({ summary: "Update a brief" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Brief updated" })
  @ApiResponse({ status: 404, description: "Brief not found" })
  update(@Param("id") id: string, @Body() dto: UpdateBriefDto) {
    return this.briefsService.update(id, dto);
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Submit a brief for review" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Brief submitted for review" })
  @ApiResponse({ status: 400, description: "Brief cannot be submitted" })
  submit(@Param("id") id: string, @Body() dto: SubmitBriefDto) {
    return this.briefsService.submit(id, dto);
  }

  @Post(":id/start-review")
  @HttpCode(HttpStatus.OK)
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
  @ApiOperation({ summary: "Complete review of a brief (approve/reject/request changes)" })
  @ApiParam({ name: "id", description: "Brief ID" })
  @ApiResponse({ status: 200, description: "Review completed" })
  @ApiResponse({ status: 400, description: "Invalid review decision" })
  review(@Param("id") id: string, @Body() dto: ReviewBriefDto) {
    return this.briefsService.review(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
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
}
