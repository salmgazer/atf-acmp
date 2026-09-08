"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Star,
  GitFork,
  Eye,
  ExternalLink,
  Github,
  Clock,
  Code,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGitHubMetadata, GitHubRepoMetadata } from "@/lib/api/hooks/use-github";

interface GitHubRepoCardProps {
  githubUrl: string;
  showFullDetails?: boolean;
}

export function GitHubRepoCard({ githubUrl, showFullDetails = false }: GitHubRepoCardProps) {
  const { data: metadata, isLoading, error } = useGitHubMetadata(githubUrl);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !metadata) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium">Unable to load repository</p>
            <p className="text-sm text-muted-foreground">
              The repository may be private or the URL may be invalid
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{metadata.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{metadata.fullName}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={metadata.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata.description && (
          <p className="text-sm text-muted-foreground">{metadata.description}</p>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{formatNumber(metadata.stars)}</span>
            <span className="text-muted-foreground">stars</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <GitFork className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatNumber(metadata.forks)}</span>
            <span className="text-muted-foreground">forks</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatNumber(metadata.watchers)}</span>
            <span className="text-muted-foreground">watchers</span>
          </div>
          {metadata.language && (
            <div className="flex items-center gap-1.5 text-sm">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span>{metadata.language}</span>
            </div>
          )}
        </div>

        {/* Topics */}
        {metadata.topics && metadata.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {metadata.topics.slice(0, 8).map((topic) => (
              <Badge key={topic} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {metadata.topics.length > 8 && (
              <Badge variant="outline" className="text-xs">
                +{metadata.topics.length - 8} more
              </Badge>
            )}
          </div>
        )}

        {/* Last update */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Last pushed {formatDistanceToNow(new Date(metadata.pushedAt), { addSuffix: true })}
          </span>
        </div>

        {showFullDetails && (
          <div className="pt-2 border-t text-xs text-muted-foreground grid grid-cols-2 gap-2">
            <div>Created: {new Date(metadata.createdAt).toLocaleDateString()}</div>
            <div>Size: {formatBytes(metadata.size * 1024)}</div>
            <div>Default branch: {metadata.defaultBranch}</div>
            <div>Open issues: {metadata.openIssues}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
