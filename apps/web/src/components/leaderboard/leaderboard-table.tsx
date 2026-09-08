"use client";

import { cn } from "@/lib/utils";
import { Trophy, Medal, Award } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/api/hooks/use-leaderboard";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  showScores: boolean;
  showStageScores?: boolean;
  loading?: boolean;
  className?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center">
        <Trophy className="h-6 w-6 text-yellow-500" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center">
        <Medal className="h-6 w-6 text-gray-400" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center">
        <Award className="h-6 w-6 text-amber-600" />
      </div>
    );
  }
  return (
    <span className="font-semibold text-muted-foreground">#{rank}</span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-8 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-muted" /></td>
    </tr>
  );
}

export function LeaderboardTable({
  entries,
  showScores,
  showStageScores = false,
  loading = false,
  className,
}: LeaderboardTableProps) {
  const stageNames = entries.length > 0 
    ? entries[0].stageScores.map((s) => s.stageName)
    : [];

  if (loading) {
    return (
      <div className={cn("overflow-x-auto rounded-lg border bg-card", className)}>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Rank</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Team</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Vertical</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Country</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...Array(10)].map((_, i) => <SkeletonRow key={i} />)}
          </tbody>
        </table>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-card p-8 text-center", className)}>
        <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No Rankings Yet</h3>
        <p className="mt-2 text-muted-foreground">
          The leaderboard will be populated once evaluations are complete.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border bg-card", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-center text-sm font-medium w-16">Rank</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Team</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Vertical</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Country</th>
            <th className="px-4 py-3 text-center text-sm font-medium">Members</th>
            {showStageScores && stageNames.map((name) => (
              <th key={name} className="px-4 py-3 text-right text-sm font-medium">
                {name}
              </th>
            ))}
            {showScores && (
              <th className="px-4 py-3 text-right text-sm font-medium">Score</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry) => (
            <tr
              key={entry.teamId}
              className={cn(
                "hover:bg-muted/50 transition-colors",
                entry.rank <= 3 && "bg-gradient-to-r",
                entry.rank === 1 && "from-yellow-50 to-transparent dark:from-yellow-950/20",
                entry.rank === 2 && "from-gray-50 to-transparent dark:from-gray-800/20",
                entry.rank === 3 && "from-amber-50 to-transparent dark:from-amber-950/20"
              )}
            >
              <td className="px-4 py-3 text-center">
                <RankBadge rank={entry.rank} />
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{entry.teamName}</div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {entry.verticalName}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {entry.country || "—"}
              </td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                {entry.memberCount}
              </td>
              {showStageScores && entry.stageScores.map((ss) => (
                <td key={ss.stageId} className="px-4 py-3 text-right text-sm">
                  {ss.score !== null ? ss.score.toFixed(1) : "—"}
                </td>
              ))}
              {showScores && (
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    "font-semibold",
                    entry.rank === 1 && "text-yellow-600 dark:text-yellow-400",
                    entry.rank === 2 && "text-gray-600 dark:text-gray-400",
                    entry.rank === 3 && "text-amber-600 dark:text-amber-400"
                  )}>
                    {entry.finalScore.toFixed(1)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
