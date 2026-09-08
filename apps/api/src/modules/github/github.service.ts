import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface GitHubRepoMetadata {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string | null;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
  isPrivate: boolean;
  size: number; // in KB
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
    login?: string;
    avatarUrl?: string;
  };
  url: string;
}

export interface GitHubContributor {
  login: string;
  avatarUrl: string;
  contributions: number;
  url: string;
}

export interface GitHubLanguages {
  [language: string]: number; // bytes of code
}

export interface GitHubReadme {
  content: string;
  encoding: string;
  size: number;
  url: string;
}

export interface GitHubRepoAnalysis {
  metadata: GitHubRepoMetadata;
  languages: GitHubLanguages;
  languagePercentages: { [language: string]: number };
  contributors: GitHubContributor[];
  recentCommits: GitHubCommit[];
  commitFrequency: {
    total: number;
    lastWeek: number;
    lastMonth: number;
  };
  readme?: string;
  fileTree?: GitHubTreeItem[];
}

export interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly baseUrl = "https://api.github.com";
  private readonly cache = new Map<string, { data: any; expiry: number }>();
  private readonly cacheTTL: number;
  private readonly token?: string;

  constructor(private configService: ConfigService) {
    this.token = this.configService.get<string>("GITHUB_TOKEN");
    this.cacheTTL = this.configService.get<number>("GITHUB_CACHE_TTL") || 3600000; // 1 hour default
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ACMP-Platform",
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private getCacheKey(endpoint: string): string {
    return `github:${endpoint}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTTL,
    });
  }

  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
      // Handle various GitHub URL formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/\?#]+)/,
        /github\.com:([^\/]+)\/([^\/\?#]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2].replace(/\.git$/, ""),
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchGitHub<T>(endpoint: string): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint);
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new BadRequestException("Repository not found or is private");
      }
      if (response.status === 403) {
        const remaining = response.headers.get("X-RateLimit-Remaining");
        if (remaining === "0") {
          const reset = response.headers.get("X-RateLimit-Reset");
          const resetDate = reset ? new Date(parseInt(reset) * 1000) : new Date();
          throw new BadRequestException(
            `GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`
          );
        }
      }
      throw new BadRequestException(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    this.setCache(cacheKey, data);
    return data as T;
  }

  async getRepoMetadata(owner: string, repo: string): Promise<GitHubRepoMetadata> {
    const data = await this.fetchGitHub<any>(`/repos/${owner}/${repo}`);

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      url: data.html_url,
      homepage: data.homepage,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      language: data.language,
      topics: data.topics || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
      size: data.size,
    };
  }

  async getLanguages(owner: string, repo: string): Promise<GitHubLanguages> {
    return this.fetchGitHub<GitHubLanguages>(`/repos/${owner}/${repo}/languages`);
  }

  async getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
    const data = await this.fetchGitHub<any[]>(
      `/repos/${owner}/${repo}/contributors?per_page=20`
    );

    return data.map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
      url: c.html_url,
    }));
  }

  async getRecentCommits(
    owner: string,
    repo: string,
    count: number = 30
  ): Promise<GitHubCommit[]> {
    const data = await this.fetchGitHub<any[]>(
      `/repos/${owner}/${repo}/commits?per_page=${count}`
    );

    return data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0], // First line only
      author: {
        name: c.commit.author.name,
        email: c.commit.author.email,
        date: c.commit.author.date,
        login: c.author?.login,
        avatarUrl: c.author?.avatar_url,
      },
      url: c.html_url,
    }));
  }

  async getReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const data = await this.fetchGitHub<GitHubReadme>(
        `/repos/${owner}/${repo}/readme`
      );
      
      if (data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
      return data.content;
    } catch {
      return null;
    }
  }

  async getFileTree(owner: string, repo: string, branch?: string): Promise<GitHubTreeItem[]> {
    const metadata = await this.getRepoMetadata(owner, repo);
    const targetBranch = branch || metadata.defaultBranch;

    const data = await this.fetchGitHub<any>(
      `/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`
    );

    return data.tree
      .filter((item: any) => item.type === "blob" || item.type === "tree")
      .map((item: any) => ({
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
      }));
  }

  calculateLanguagePercentages(languages: GitHubLanguages): { [key: string]: number } {
    const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    if (total === 0) return {};

    const percentages: { [key: string]: number } = {};
    for (const [lang, bytes] of Object.entries(languages)) {
      percentages[lang] = Math.round((bytes / total) * 1000) / 10; // One decimal
    }
    return percentages;
  }

  calculateCommitFrequency(commits: GitHubCommit[]): {
    total: number;
    lastWeek: number;
    lastMonth: number;
  } {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let lastWeek = 0;
    let lastMonth = 0;

    for (const commit of commits) {
      const commitDate = new Date(commit.author.date);
      if (commitDate >= weekAgo) lastWeek++;
      if (commitDate >= monthAgo) lastMonth++;
    }

    return {
      total: commits.length,
      lastWeek,
      lastMonth,
    };
  }

  async analyzeRepository(githubUrl: string): Promise<GitHubRepoAnalysis> {
    const parsed = this.parseGitHubUrl(githubUrl);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    const { owner, repo } = parsed;

    // Fetch all data in parallel
    const [metadata, languages, contributors, commits, readme] = await Promise.all([
      this.getRepoMetadata(owner, repo),
      this.getLanguages(owner, repo),
      this.getContributors(owner, repo),
      this.getRecentCommits(owner, repo, 100),
      this.getReadme(owner, repo),
    ]);

    if (metadata.isPrivate) {
      throw new BadRequestException("Repository is private");
    }

    const languagePercentages = this.calculateLanguagePercentages(languages);
    const commitFrequency = this.calculateCommitFrequency(commits);

    return {
      metadata,
      languages,
      languagePercentages,
      contributors,
      recentCommits: commits.slice(0, 20),
      commitFrequency,
      readme: readme || undefined,
    };
  }

  async getRepositoryForAIAnalysis(githubUrl: string): Promise<{
    metadata: GitHubRepoMetadata;
    languages: GitHubLanguages;
    fileStructure: GitHubTreeItem[];
    commitPatterns: {
      frequency: { total: number; lastWeek: number; lastMonth: number };
      contributorCount: number;
      recentMessages: string[];
    };
    readme?: string;
  }> {
    const parsed = this.parseGitHubUrl(githubUrl);
    if (!parsed) {
      throw new BadRequestException("Invalid GitHub URL");
    }

    const { owner, repo } = parsed;

    const [metadata, languages, fileTree, commits, readme] = await Promise.all([
      this.getRepoMetadata(owner, repo),
      this.getLanguages(owner, repo),
      this.getFileTree(owner, repo),
      this.getRecentCommits(owner, repo, 100),
      this.getReadme(owner, repo),
    ]);

    const commitFrequency = this.calculateCommitFrequency(commits);

    // Get unique contributors from commits
    const uniqueContributors = new Set(
      commits.map((c) => c.author.login || c.author.email)
    );

    return {
      metadata,
      languages,
      fileStructure: fileTree,
      commitPatterns: {
        frequency: commitFrequency,
        contributorCount: uniqueContributors.size,
        recentMessages: commits.slice(0, 20).map((c) => c.message),
      },
      readme: readme || undefined,
    };
  }

  async getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepoMetadata> {
    return this.getRepoMetadata(owner, repo);
  }

  async getFileStructure(owner: string, repo: string): Promise<GitHubTreeItem[]> {
    return this.getFileTree(owner, repo);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
