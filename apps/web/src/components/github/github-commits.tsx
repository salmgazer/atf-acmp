"use client";

import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGitHubCommits } from "@/lib/api/hooks/use-github";
import { GitCommit, Loader2, ExternalLink } from "lucide-react";

interface GitHubCommitsProps {
  githubUrl: string;
  maxDisplay?: number;
}

export function GitHubCommits({ githubUrl, maxDisplay = 10 }: GitHubCommitsProps) {
  const { data: commits, isLoading } = useGitHubCommits(githubUrl, maxDisplay);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No commits found
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitCommit className="h-4 w-4" />
          Recent Commits
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {commits.map((commit) => (
            <a
              key={commit.sha}
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors group"
            >
              <Avatar className="h-6 w-6 mt-0.5">
                {commit.author.avatarUrl ? (
                  <AvatarImage src={commit.author.avatarUrl} alt={commit.author.name} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {commit.author.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium truncate">{commit.message}</p>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{commit.author.login || commit.author.name}</span>
                  <span>·</span>
                  <span>
                    {formatDistanceToNow(new Date(commit.author.date), { addSuffix: true })}
                  </span>
                  <span>·</span>
                  <code className="text-xs">{commit.sha.slice(0, 7)}</code>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
