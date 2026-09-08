"use client";

import { useState, useMemo } from "react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LeaderboardTable, LeaderboardFilters } from "@/components/leaderboard";
import {
  usePublicLeaderboard,
  useTeamRank,
  type LeaderboardQueryParams,
} from "@/lib/api/hooks/use-leaderboard";
import { useActiveCohort } from "@/lib/api/hooks/use-cohorts";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Trophy, Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

function TeamRankCard({
  rank,
  totalTeams,
  teamName,
}: {
  rank: number | null;
  totalTeams: number;
  teamName: string;
}) {
  if (rank === null) {
    return null;
  }

  const percentile = totalTeams > 0 ? Math.round(((totalTeams - rank + 1) / totalTeams) * 100) : 0;

  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-background p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Your Team Rank</p>
          <h2 className="mt-1 text-4xl font-bold">{rank}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            out of {totalTeams} teams
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <TrendingUp className={cn(
              "h-5 w-5",
              percentile >= 80 ? "text-green-500" :
              percentile >= 50 ? "text-yellow-500" : "text-muted-foreground"
            )} />
            <span className="text-2xl font-semibold">Top {100 - percentile + 1}%</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{teamName}</p>
        </div>
      </div>
    </div>
  );
}

function LeaderboardContent() {
  const { data: activeCohort, isLoading: isLoadingCohort } = useActiveCohort();
  const { data: verticalsData } = useVerticals(activeCohort?.id || "");
  const { user } = useAuthStore();

  // Get user's team ID from participant data
  const teamId = (user as any)?.teamId || "";

  const [filters, setFilters] = useState<{
    verticalId?: string;
    country?: string;
  }>({});

  const queryParams: LeaderboardQueryParams = useMemo(
    () => ({
      cohortId: activeCohort?.id || "",
      ...filters,
      limit: 50,
    }),
    [activeCohort?.id, filters]
  );

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = usePublicLeaderboard(queryParams);
  const { data: teamRank } = useTeamRank(activeCohort?.id || "", teamId);

  // Extract unique countries from entries
  const countries = useMemo(() => {
    if (!leaderboard?.entries) return [];
    const uniqueCountries = new Set<string>();
    leaderboard.entries.forEach((e) => {
      if (e.country) uniqueCountries.add(e.country);
    });
    return Array.from(uniqueCountries).sort();
  }, [leaderboard?.entries]);

  // Find user's team in leaderboard
  const userTeamEntry = leaderboard?.entries.find((e) => e.teamId === teamId);

  if (!activeCohort && !isLoadingCohort) {
    return (
      <ParticipantLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Active Challenge</h2>
          <p className="mt-2 text-muted-foreground">
            There is no active challenge at the moment.
          </p>
        </div>
      </ParticipantLayout>
    );
  }

  // Check if leaderboard is public
  if (leaderboard && !leaderboard.meta.isPublic) {
    return (
      <ParticipantLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Leaderboard Not Available</h2>
          <p className="mt-2 text-muted-foreground">
            The leaderboard for this challenge is not publicly available yet.
          </p>
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            {activeCohort?.name || "Loading..."} - See how teams are performing
          </p>
        </div>

        {/* User's Team Rank Card */}
        {teamRank && teamRank.rank !== null && userTeamEntry && (
          <TeamRankCard
            rank={teamRank.rank}
            totalTeams={teamRank.totalTeams}
            teamName={userTeamEntry.teamName}
          />
        )}

        {/* Filters */}
        <LeaderboardFilters
          verticals={verticalsData?.map((v) => ({ id: v.id, name: v.name })) ?? []}
          countries={countries}
          selectedVertical={filters.verticalId}
          selectedCountry={filters.country}
          onVerticalChange={(v) => setFilters((f) => ({ ...f, verticalId: v }))}
          onCountryChange={(c) => setFilters((f) => ({ ...f, country: c }))}
          onReset={() => setFilters({})}
        />

        {/* Leaderboard Table */}
        <LeaderboardTable
          entries={leaderboard?.entries ?? []}
          showScores={leaderboard?.meta.showScores ?? false}
          loading={isLoadingLeaderboard || isLoadingCohort}
        />

        {/* Total Count */}
        {leaderboard && leaderboard.entries.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Showing {leaderboard.entries.length} of {leaderboard.meta.total} teams
          </p>
        )}
      </div>
    </ParticipantLayout>
  );
}

export default function ParticipantLeaderboardPage() {
  return (
    <ProtectedRoute portal="participant">
      <LeaderboardContent />
    </ProtectedRoute>
  );
}
