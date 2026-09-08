import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
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
import { GitHubService } from "./github.service";
import { GitHubAnalysisService } from "./github-analysis.service";

@ApiTags("github")
@Controller("github")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GitHubController {
  constructor(
    private readonly githubService: GitHubService,
    private readonly analysisService: GitHubAnalysisService,
  ) {}

  @Get("analyze")
  @ApiOperation({ summary: "Analyze a GitHub repository" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiResponse({ status: 200, description: "Repository analysis" })
  @ApiResponse({ status: 400, description: "Invalid URL" })
  async analyzeRepository(@Query("url") url: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }
    return this.githubService.analyzeRepository(url);
  }

  @Get("metadata")
  @ApiOperation({ summary: "Get repository metadata" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiResponse({ status: 200, description: "Repository metadata" })
  async getMetadata(@Query("url") url: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    return this.githubService.getRepoMetadata(parsed.owner, parsed.repo);
  }

  @Get("languages")
  @ApiOperation({ summary: "Get repository languages breakdown" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiResponse({ status: 200, description: "Language statistics" })
  async getLanguages(@Query("url") url: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    const languages = await this.githubService.getLanguages(parsed.owner, parsed.repo);
    const percentages = this.githubService.calculateLanguagePercentages(languages);

    return { languages, percentages };
  }

  @Get("commits")
  @ApiOperation({ summary: "Get recent commits" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiQuery({ name: "count", required: false, description: "Number of commits (default: 30)" })
  @ApiResponse({ status: 200, description: "List of commits" })
  async getCommits(@Query("url") url: string, @Query("count") count?: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    const commitCount = count ? parseInt(count, 10) : 30;
    return this.githubService.getRecentCommits(
      parsed.owner,
      parsed.repo,
      commitCount
    );
  }

  @Get("contributors")
  @ApiOperation({ summary: "Get repository contributors" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiResponse({ status: 200, description: "List of contributors" })
  async getContributors(@Query("url") url: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    return this.githubService.getContributors(parsed.owner, parsed.repo);
  }

  @Get("readme")
  @ApiOperation({ summary: "Get repository README" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiResponse({ status: 200, description: "README content" })
  async getReadme(@Query("url") url: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    const readme = await this.githubService.getReadme(parsed.owner, parsed.repo);
    return { readme };
  }

  @Get("tree")
  @ApiOperation({ summary: "Get repository file tree" })
  @ApiQuery({ name: "url", required: true, description: "GitHub repository URL" })
  @ApiResponse({ status: 200, description: "File tree structure" })
  async getFileTree(@Query("url") url: string) {
    if (!url) {
      throw new BadRequestException("GitHub URL is required");
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    return this.githubService.getFileTree(parsed.owner, parsed.repo);
  }
}

@ApiTags("github-admin")
@Controller("admin/github")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminGitHubController {
  constructor(private readonly analysisService: GitHubAnalysisService) {}

  @Post("analyze")
  @ApiOperation({ summary: "Run GitHub analysis for a team submission" })
  @ApiResponse({ status: 201, description: "Analysis started" })
  async runAnalysis(
    @Body() body: { teamId: string; githubUrl: string; submissionId?: string },
  ) {
    return this.analysisService.analyzeRepository(
      body.teamId,
      body.githubUrl,
      body.submissionId,
    );
  }

  @Get("analysis/:id")
  @ApiOperation({ summary: "Get a specific analysis by ID" })
  @ApiParam({ name: "id", description: "Analysis ID" })
  @ApiResponse({ status: 200, description: "Analysis details" })
  @ApiResponse({ status: 404, description: "Analysis not found" })
  async getAnalysis(@Param("id", ParseUUIDPipe) id: string) {
    return this.analysisService.getAnalysisById(id);
  }

  @Get("analysis/:id/ai")
  @ApiOperation({ summary: "Get analysis formatted for AI evaluation" })
  @ApiParam({ name: "id", description: "Analysis ID" })
  @ApiResponse({ status: 200, description: "AI-formatted analysis" })
  async getAnalysisForAI(@Param("id", ParseUUIDPipe) id: string) {
    return this.analysisService.getAnalysisForAI(id);
  }

  @Get("team/:teamId")
  @ApiOperation({ summary: "Get all analyses for a team" })
  @ApiParam({ name: "teamId", description: "Team ID" })
  @ApiResponse({ status: 200, description: "List of team analyses" })
  async getTeamAnalyses(@Param("teamId", ParseUUIDPipe) teamId: string) {
    return this.analysisService.getTeamAnalyses(teamId);
  }

  @Get("submission/:submissionId")
  @ApiOperation({ summary: "Get analysis for a specific submission" })
  @ApiParam({ name: "submissionId", description: "Submission ID" })
  @ApiResponse({ status: 200, description: "Submission analysis" })
  async getSubmissionAnalysis(
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
  ) {
    return this.analysisService.getSubmissionAnalysis(submissionId);
  }
}
