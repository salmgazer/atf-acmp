import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Team } from "./team.entity";
import { Submission } from "./stage.entity";

export interface RepositoryMetrics {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  size: number; // KB
  contributorCount: number;
  totalCommits: number;
  commitsLastWeek: number;
  commitsLastMonth: number;
  primaryLanguage: string | null;
  languageBreakdown: { [language: string]: number }; // percentages
  topics: string[];
  hasReadme: boolean;
  readmeLength: number;
  lastPushedAt: string;
  createdAt: string;
}

export interface CodeStructureAnalysis {
  totalFiles: number;
  totalDirectories: number;
  filesByExtension: { [ext: string]: number };
  hasPackageJson: boolean;
  hasDockerfile: boolean;
  hasCIConfig: boolean; // .github/workflows, .gitlab-ci.yml, etc.
  hasTests: boolean; // test/, tests/, __tests__, spec/
  hasDocumentation: boolean; // docs/, README patterns
  maxDirectoryDepth: number;
  averageFilesPerDirectory: number;
}

export interface CommitPatternAnalysis {
  totalAuthors: number;
  uniqueAuthors: string[];
  commitMessagePatterns: {
    hasConventionalCommits: boolean;
    averageMessageLength: number;
    commonPrefixes: string[];
  };
  activityByDay: { [day: string]: number }; // Mon, Tue, etc.
  activityByHour: { [hour: string]: number }; // 0-23
  averageCommitsPerDay: number;
  longestStreak: number; // consecutive days
}

export interface AIEvaluationData {
  repositoryMetrics: RepositoryMetrics;
  codeStructure: CodeStructureAnalysis;
  commitPatterns: CommitPatternAnalysis;
  readme?: string;
  summary: {
    healthScore: number; // 0-100
    activityLevel: "low" | "medium" | "high";
    codeQualityIndicators: string[];
    concerns: string[];
    strengths: string[];
  };
}

@Entity("github_analyses")
@Index(["teamId"])
@Index(["submissionId"])
@Index(["analyzedAt"])
export class GitHubAnalysis extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "submission_id", nullable: true })
  submissionId?: string;

  @ManyToOne(() => Submission, { nullable: true })
  @JoinColumn({ name: "submission_id" })
  submission?: Submission;

  @Column({ name: "github_url" })
  githubUrl: string;

  @Column({ name: "repo_full_name" })
  repoFullName: string;

  @Column({ type: "jsonb" })
  metrics: RepositoryMetrics;

  @Column({ name: "code_structure", type: "jsonb" })
  codeStructure: CodeStructureAnalysis;

  @Column({ name: "commit_patterns", type: "jsonb" })
  commitPatterns: CommitPatternAnalysis;

  @Column({ type: "text", nullable: true })
  readme?: string;

  @Column({ type: "jsonb", nullable: true })
  summary?: AIEvaluationData["summary"];

  @Column({ name: "analyzed_at", type: "timestamp" })
  analyzedAt: Date;

  @Column({ name: "analysis_version", default: 1 })
  analysisVersion: number;

  @Column({ name: "error_message", nullable: true })
  errorMessage?: string;
}
