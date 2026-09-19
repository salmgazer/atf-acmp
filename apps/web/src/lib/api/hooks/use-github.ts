import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

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
  size: number;
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
  [language: string]: number;
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
}

// Analyze full repository
export function useGitHubAnalysis(githubUrl: string | undefined) {
  return useQuery<GitHubRepoAnalysis>({
    queryKey: ["github", "analysis", githubUrl],
    queryFn: () => api.get<GitHubRepoAnalysis>(`/github/analyze?url=${encodeURIComponent(githubUrl!)}`),
    enabled: !!githubUrl,
    refetchOnWindowFocus: false,
    staleTime: 60000, // 1 minute
  });
}

// Get just metadata
export function useGitHubMetadata(githubUrl: string | undefined) {
  return useQuery<GitHubRepoMetadata>({
    queryKey: ["github", "metadata", githubUrl],
    queryFn: () => api.get<GitHubRepoMetadata>(`/github/metadata?url=${encodeURIComponent(githubUrl!)}`),
    enabled: !!githubUrl,
    refetchOnWindowFocus: false,
  });
}

// Get languages
export function useGitHubLanguages(githubUrl: string | undefined) {
  return useQuery<{ languages: GitHubLanguages; percentages: { [key: string]: number } }>({
    queryKey: ["github", "languages", githubUrl],
    queryFn: () => api.get<{ languages: GitHubLanguages; percentages: { [key: string]: number } }>(`/github/languages?url=${encodeURIComponent(githubUrl!)}`),
    enabled: !!githubUrl,
    refetchOnWindowFocus: false,
  });
}

// Get commits
export function useGitHubCommits(githubUrl: string | undefined, count?: number) {
  const params = new URLSearchParams();
  if (githubUrl) params.set("url", githubUrl);
  if (count) params.set("count", count.toString());

  return useQuery<GitHubCommit[]>({
    queryKey: ["github", "commits", githubUrl, count],
    queryFn: () => api.get<GitHubCommit[]>(`/github/commits?${params.toString()}`),
    enabled: !!githubUrl,
    refetchOnWindowFocus: false,
  });
}

// Get contributors
export function useGitHubContributors(githubUrl: string | undefined) {
  return useQuery<GitHubContributor[]>({
    queryKey: ["github", "contributors", githubUrl],
    queryFn: () => api.get<GitHubContributor[]>(`/github/contributors?url=${encodeURIComponent(githubUrl!)}`),
    enabled: !!githubUrl,
    refetchOnWindowFocus: false,
  });
}

// Get readme
export function useGitHubReadme(githubUrl: string | undefined) {
  return useQuery<{ readme: string | null }>({
    queryKey: ["github", "readme", githubUrl],
    queryFn: () => api.get<{ readme: string | null }>(`/github/readme?url=${encodeURIComponent(githubUrl!)}`),
    enabled: !!githubUrl,
    refetchOnWindowFocus: false,
  });
}
