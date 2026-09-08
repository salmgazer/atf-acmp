"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useGitHubAnalysis } from "@/lib/api/hooks/use-github";
import {
  Star,
  GitFork,
  Users,
  GitCommit,
  Clock,
  Code,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GitHubStatsSummaryProps {
  githubUrl: string;
}

export function GitHubStatsSummary({ githubUrl }: GitHubStatsSummaryProps) {
  const { data, isLoading, error } = useGitHubAnalysis(githubUrl);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Unable to load GitHub stats
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      icon: Star,
      label: "Stars",
      value: data.metadata.stars,
      color: "text-amber-500",
    },
    {
      icon: GitFork,
      label: "Forks",
      value: data.metadata.forks,
    },
    {
      icon: Users,
      label: "Contributors",
      value: data.contributors.length,
    },
    {
      icon: GitCommit,
      label: "Commits (30d)",
      value: data.commitFrequency.lastMonth,
    },
    {
      icon: Code,
      label: "Language",
      value: data.metadata.language || "N/A",
    },
    {
      icon: Clock,
      label: "Last Push",
      value: formatDistanceToNow(new Date(data.metadata.pushedAt), { addSuffix: true }),
    },
  ];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color || "text-muted-foreground"}`} />
              <div className="text-lg font-semibold">
                {typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
