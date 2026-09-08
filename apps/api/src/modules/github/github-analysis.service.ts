import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  GitHubAnalysis,
  RepositoryMetrics,
  CodeStructureAnalysis,
  CommitPatternAnalysis,
} from "@/database/entities/github-analysis.entity";
import { GitHubService, GitHubTreeItem, GitHubCommit } from "./github.service";

@Injectable()
export class GitHubAnalysisService {
  private readonly logger = new Logger(GitHubAnalysisService.name);

  constructor(
    @InjectRepository(GitHubAnalysis)
    private analysisRepository: Repository<GitHubAnalysis>,
    private githubService: GitHubService,
  ) {}

  async analyzeRepository(
    teamId: string,
    githubUrl: string,
    submissionId?: string,
  ): Promise<GitHubAnalysis> {
    this.logger.log(`Analyzing repository: ${githubUrl} for team ${teamId}`);

    const parsed = this.githubService.parseGitHubUrl(githubUrl);
    if (!parsed) {
      throw new Error("Invalid GitHub URL");
    }

    try {
      // Fetch all data from GitHub
      const [metadata, languages, contributors, commits, readme, fileTree] =
        await Promise.all([
          this.githubService.getRepoMetadata(parsed.owner, parsed.repo),
          this.githubService.getLanguages(parsed.owner, parsed.repo),
          this.githubService.getContributors(parsed.owner, parsed.repo),
          this.githubService.getRecentCommits(parsed.owner, parsed.repo, 100),
          this.githubService.getReadme(parsed.owner, parsed.repo),
          this.githubService.getFileTree(parsed.owner, parsed.repo),
        ]);

      const languagePercentages = this.githubService.calculateLanguagePercentages(languages);
      const commitFrequency = this.githubService.calculateCommitFrequency(commits);

      // Build metrics
      const metrics: RepositoryMetrics = {
        stars: metadata.stars,
        forks: metadata.forks,
        watchers: metadata.watchers,
        openIssues: metadata.openIssues,
        size: metadata.size,
        contributorCount: contributors.length,
        totalCommits: commitFrequency.total,
        commitsLastWeek: commitFrequency.lastWeek,
        commitsLastMonth: commitFrequency.lastMonth,
        primaryLanguage: metadata.language,
        languageBreakdown: languagePercentages,
        topics: metadata.topics,
        hasReadme: !!readme,
        readmeLength: readme?.length || 0,
        lastPushedAt: metadata.pushedAt,
        createdAt: metadata.createdAt,
      };

      // Analyze code structure
      const codeStructure = this.analyzeCodeStructure(fileTree);

      // Analyze commit patterns
      const commitPatterns = this.analyzeCommitPatterns(commits);

      // Generate summary
      const summary = this.generateSummary(metrics, codeStructure, commitPatterns);

      // Save or update analysis
      let analysis = await this.analysisRepository.findOne({
        where: { teamId, githubUrl },
      });

      if (analysis) {
        analysis.metrics = metrics;
        analysis.codeStructure = codeStructure;
        analysis.commitPatterns = commitPatterns;
        analysis.readme = readme || undefined;
        analysis.summary = summary;
        analysis.analyzedAt = new Date();
        analysis.analysisVersion += 1;
        analysis.errorMessage = undefined;
      } else {
        analysis = this.analysisRepository.create({
          teamId,
          submissionId,
          githubUrl,
          repoFullName: metadata.fullName,
          metrics,
          codeStructure,
          commitPatterns,
          readme: readme || undefined,
          summary,
          analyzedAt: new Date(),
        });
      }

      return this.analysisRepository.save(analysis);
    } catch (error: any) {
      this.logger.error(`Failed to analyze repository: ${error.message}`);

      // Save error state
      const analysis = this.analysisRepository.create({
        teamId,
        submissionId,
        githubUrl,
        repoFullName: `${parsed.owner}/${parsed.repo}`,
        metrics: {} as RepositoryMetrics,
        codeStructure: {} as CodeStructureAnalysis,
        commitPatterns: {} as CommitPatternAnalysis,
        analyzedAt: new Date(),
        errorMessage: error.message,
      });

      return this.analysisRepository.save(analysis);
    }
  }

  private analyzeCodeStructure(fileTree: GitHubTreeItem[]): CodeStructureAnalysis {
    const files = fileTree.filter((item) => item.type === "blob");
    const directories = fileTree.filter((item) => item.type === "tree");

    // Count files by extension
    const filesByExtension: { [ext: string]: number } = {};
    for (const file of files) {
      const ext = file.path.split(".").pop()?.toLowerCase() || "no-ext";
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
    }

    // Check for common patterns
    const filePaths = files.map((f) => f.path.toLowerCase());
    const dirPaths = directories.map((d) => d.path.toLowerCase());

    const hasPackageJson = filePaths.some((p) => p === "package.json" || p.endsWith("/package.json"));
    const hasDockerfile = filePaths.some((p) => p.includes("dockerfile"));
    const hasCIConfig = filePaths.some(
      (p) =>
        p.includes(".github/workflows") ||
        p.includes(".gitlab-ci") ||
        p.includes(".circleci") ||
        p.includes("jenkinsfile") ||
        p.includes(".travis")
    );
    const hasTests = dirPaths.some(
      (p) =>
        p === "test" ||
        p === "tests" ||
        p === "__tests__" ||
        p === "spec" ||
        p.includes("/test") ||
        p.includes("/tests")
    ) || filePaths.some((p) => p.includes(".test.") || p.includes(".spec."));
    const hasDocumentation = dirPaths.some((p) => p === "docs" || p === "documentation");

    // Calculate max depth
    const maxDirectoryDepth = Math.max(
      ...fileTree.map((item) => item.path.split("/").length - 1),
      0
    );

    // Average files per directory
    const dirsWithFiles = new Set<string>();
    for (const file of files) {
      const dir = file.path.split("/").slice(0, -1).join("/") || "/";
      dirsWithFiles.add(dir);
    }
    const averageFilesPerDirectory =
      dirsWithFiles.size > 0 ? Math.round(files.length / dirsWithFiles.size) : 0;

    return {
      totalFiles: files.length,
      totalDirectories: directories.length,
      filesByExtension,
      hasPackageJson,
      hasDockerfile,
      hasCIConfig,
      hasTests,
      hasDocumentation,
      maxDirectoryDepth,
      averageFilesPerDirectory,
    };
  }

  private analyzeCommitPatterns(commits: GitHubCommit[]): CommitPatternAnalysis {
    if (commits.length === 0) {
      return {
        totalAuthors: 0,
        uniqueAuthors: [],
        commitMessagePatterns: {
          hasConventionalCommits: false,
          averageMessageLength: 0,
          commonPrefixes: [],
        },
        activityByDay: {},
        activityByHour: {},
        averageCommitsPerDay: 0,
        longestStreak: 0,
      };
    }

    // Unique authors
    const authorSet = new Set<string>();
    for (const commit of commits) {
      authorSet.add(commit.author.login || commit.author.email);
    }
    const uniqueAuthors = Array.from(authorSet);

    // Commit message analysis
    const messages = commits.map((c) => c.message);
    const conventionalPrefixes = ["feat", "fix", "docs", "style", "refactor", "test", "chore"];
    const hasConventionalCommits = messages.some((m) =>
      conventionalPrefixes.some((p) => m.toLowerCase().startsWith(`${p}:`))
    );
    const averageMessageLength = Math.round(
      messages.reduce((sum, m) => sum + m.length, 0) / messages.length
    );

    // Extract common prefixes
    const prefixCounts: { [prefix: string]: number } = {};
    for (const msg of messages) {
      const match = msg.match(/^(\w+)[\s:(]/);
      if (match) {
        const prefix = match[1].toLowerCase();
        prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
      }
    }
    const commonPrefixes = Object.entries(prefixCounts)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([prefix]) => prefix);

    // Activity by day/hour
    const activityByDay: { [day: string]: number } = {};
    const activityByHour: { [hour: string]: number } = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (const commit of commits) {
      const date = new Date(commit.author.date);
      const day = days[date.getDay()];
      const hour = date.getHours().toString();
      activityByDay[day] = (activityByDay[day] || 0) + 1;
      activityByHour[hour] = (activityByHour[hour] || 0) + 1;
    }

    // Calculate streak and average
    const commitDates = commits.map((c) => new Date(c.author.date).toDateString());
    const uniqueDates = [...new Set(commitDates)];
    const averageCommitsPerDay =
      uniqueDates.length > 0 ? Math.round((commits.length / uniqueDates.length) * 10) / 10 : 0;

    // Simple streak calculation
    let longestStreak = 1;
    let currentStreak = 1;
    const sortedDates = uniqueDates.map((d) => new Date(d).getTime()).sort((a, b) => b - a);
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = sortedDates[i - 1] - sortedDates[i];
      if (diff <= 86400000 * 1.5) {
        // ~1.5 days
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return {
      totalAuthors: uniqueAuthors.length,
      uniqueAuthors,
      commitMessagePatterns: {
        hasConventionalCommits,
        averageMessageLength,
        commonPrefixes,
      },
      activityByDay,
      activityByHour,
      averageCommitsPerDay,
      longestStreak,
    };
  }

  private generateSummary(
    metrics: RepositoryMetrics,
    codeStructure: CodeStructureAnalysis,
    commitPatterns: CommitPatternAnalysis,
  ) {
    let healthScore = 50; // Start at 50

    const strengths: string[] = [];
    const concerns: string[] = [];
    const codeQualityIndicators: string[] = [];

    // Activity scoring
    if (metrics.commitsLastWeek >= 5) {
      healthScore += 10;
      strengths.push("Active development (5+ commits last week)");
    } else if (metrics.commitsLastWeek === 0) {
      healthScore -= 10;
      concerns.push("No commits in the last week");
    }

    // Contributors
    if (commitPatterns.totalAuthors >= 3) {
      healthScore += 10;
      strengths.push("Multiple active contributors");
    } else if (commitPatterns.totalAuthors === 1) {
      concerns.push("Single contributor only");
    }

    // Code structure
    if (codeStructure.hasTests) {
      healthScore += 10;
      codeQualityIndicators.push("Has test files");
      strengths.push("Test coverage present");
    } else {
      healthScore -= 5;
      concerns.push("No test files detected");
    }

    if (codeStructure.hasCIConfig) {
      healthScore += 5;
      codeQualityIndicators.push("CI/CD configured");
      strengths.push("Continuous integration setup");
    }

    if (codeStructure.hasDockerfile) {
      healthScore += 5;
      codeQualityIndicators.push("Containerized");
    }

    if (metrics.hasReadme) {
      healthScore += 5;
      if (metrics.readmeLength > 500) {
        strengths.push("Well-documented README");
      }
    } else {
      healthScore -= 5;
      concerns.push("No README file");
    }

    // Commit patterns
    if (commitPatterns.commitMessagePatterns.hasConventionalCommits) {
      healthScore += 5;
      codeQualityIndicators.push("Conventional commits");
      strengths.push("Follows conventional commit format");
    }

    if (commitPatterns.longestStreak >= 5) {
      strengths.push(`Consistent activity (${commitPatterns.longestStreak} day streak)`);
    }

    // Activity level
    let activityLevel: "low" | "medium" | "high" = "medium";
    if (metrics.commitsLastMonth >= 30) {
      activityLevel = "high";
    } else if (metrics.commitsLastMonth < 5) {
      activityLevel = "low";
    }

    // Clamp health score
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      healthScore,
      activityLevel,
      codeQualityIndicators,
      concerns,
      strengths,
    };
  }

  async getAnalysis(teamId: string, githubUrl?: string): Promise<GitHubAnalysis | null> {
    const where: any = { teamId };
    if (githubUrl) {
      where.githubUrl = githubUrl;
    }

    return this.analysisRepository.findOne({
      where,
      order: { analyzedAt: "DESC" },
    });
  }

  async getAnalysisById(id: string): Promise<GitHubAnalysis> {
    const analysis = await this.analysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException("Analysis not found");
    }
    return analysis;
  }

  async getTeamAnalyses(teamId: string): Promise<GitHubAnalysis[]> {
    return this.analysisRepository.find({
      where: { teamId },
      order: { analyzedAt: "DESC" },
    });
  }

  async getSubmissionAnalysis(submissionId: string): Promise<GitHubAnalysis | null> {
    return this.analysisRepository.findOne({
      where: { submissionId },
      order: { analyzedAt: "DESC" },
    });
  }

  async getAnalysisForAI(id: string) {
    const analysis = await this.getAnalysisById(id);
    
    return {
      repositoryUrl: analysis.githubUrl,
      repositoryName: analysis.repoFullName,
      metrics: analysis.metrics,
      codeStructure: analysis.codeStructure,
      commitPatterns: analysis.commitPatterns,
      summary: analysis.summary,
      readme: analysis.readme,
      analyzedAt: analysis.analyzedAt,
    };
  }
}
