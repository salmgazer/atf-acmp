import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "@/common/decorators/public.decorator";
import { PublicService } from "./public.service";
import {
  PublicSubmissionDto,
  PublicSubmissionResponseDto,
} from "./dto/public-submission.dto";

@ApiTags("Public")
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * Submit organization and AI opportunity briefs from public form
   * This endpoint is public (no authentication required)
   */
  @Post("organization-briefs")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Submit organization and AI opportunity briefs",
    description:
      "Public endpoint for organizations to submit their details and 1-3 AI opportunity briefs. " +
      "Includes automatic fit scoring based on questionnaire answers. " +
      "Duplicate submissions are detected via session ID.",
  })
  @ApiResponse({
    status: 200,
    description: "Submission successful",
    type: PublicSubmissionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or no active cohort",
  })
  @ApiResponse({
    status: 500,
    description: "Server error during submission",
  })
  async submitOrganizationBriefs(
    @Body() dto: PublicSubmissionDto
  ): Promise<PublicSubmissionResponseDto> {
    return this.publicService.submitOrganizationBriefs(dto);
  }

  /**
   * Preview fit scores without submitting
   */
  @Post("preview-scores")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Preview fit scores",
    description: "Calculate fit and impact scores without submitting the form",
  })
  async previewScores(@Body() scoringAnswers: any) {
    return this.publicService.calculatePreviewScores(scoringAnswers);
  }
}
