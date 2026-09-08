"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGitHubContributors } from "@/lib/api/hooks/use-github";
import { Loader2, Users } from "lucide-react";

interface GitHubContributorsProps {
  githubUrl: string;
  maxDisplay?: number;
}

export function GitHubContributors({ githubUrl, maxDisplay = 10 }: GitHubContributorsProps) {
  const { data: contributors, isLoading } = useGitHubContributors(githubUrl);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!contributors || contributors.length === 0) {
    return null;
  }

  const displayContributors = contributors.slice(0, maxDisplay);
  const remainingCount = contributors.length - maxDisplay;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Contributors ({contributors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayContributors.map((contributor) => (
            <a
              key={contributor.login}
              href={contributor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={contributor.avatarUrl} alt={contributor.login} />
                  <AvatarFallback>
                    {contributor.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">{contributor.login}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {contributor.contributions} commits
              </span>
            </a>
          ))}
          {remainingCount > 0 && (
            <p className="text-sm text-muted-foreground text-center pt-2">
              +{remainingCount} more contributors
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
