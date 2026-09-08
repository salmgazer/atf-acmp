"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// ============ Types ============

export interface LeaderboardQueryParams {
  cohortId: string;
  stageId?: string;
  verticalId?: string;
  country?: string;
  limit?: number;
  offset?: number;
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  verticalId: string;
  verticalName: string;
  country: string | null;
  memberCount: number;
  finalScore: number;
  stageScores: Array<{
    stageId: string;
    stageName: string;
    score: number | null;
  }>;
  evaluatedAt: string | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    cohortId: string;
    cohortName: string;
    isPublic: boolean;
    showScores: boolean;
  };
  filters: {
    verticalId?: string;
    country?: string;
    stageId?: string;
  };
}

export interface LeaderboardConfig {
  isPublic: boolean;
  showScores: boolean;
  contributingStageIds: string[];
}

export interface TeamRank {
  rank: number | null;
  totalTeams: number;
}

// ============ Query Keys ============

export const leaderboardKeys = {
  all: ["leaderboard"] as const,
  public: (params: LeaderboardQueryParams) => [...leaderboardKeys.all, "public", params] as const,
  admin: (params: LeaderboardQueryParams) => [...leaderboardKeys.all, "admin", params] as const,
  config: (cohortId: string) => [...leaderboardKeys.all, "config", cohortId] as const,
  teamRank: (cohortId: string, teamId: string) =>
    [...leaderboardKeys.all, "team", cohortId, teamId] as const,
};

// ============ Utility ============

function buildQueryString(params: LeaderboardQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("cohortId", params.cohortId);
  if (params.stageId) searchParams.set("stageId", params.stageId);
  if (params.verticalId) searchParams.set("verticalId", params.verticalId);
  if (params.country) searchParams.set("country", params.country);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  return searchParams.toString();
}

// ============ Hooks ============

export function usePublicLeaderboard(params: LeaderboardQueryParams) {
  return useQuery({
    queryKey: leaderboardKeys.public(params),
    queryFn: () => api.get<LeaderboardResponse>(`/leaderboard?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}

export function useAdminLeaderboard(params: LeaderboardQueryParams) {
  return useQuery({
    queryKey: leaderboardKeys.admin(params),
    queryFn: () => api.get<LeaderboardResponse>(`/admin/leaderboard?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}

export function useLeaderboardConfig(cohortId: string) {
  return useQuery({
    queryKey: leaderboardKeys.config(cohortId),
    queryFn: () => api.get<LeaderboardConfig>(`/admin/leaderboard/config/${cohortId}`),
    enabled: !!cohortId,
  });
}

export function useTeamRank(cohortId: string, teamId: string) {
  return useQuery({
    queryKey: leaderboardKeys.teamRank(cohortId, teamId),
    queryFn: () => api.get<TeamRank>(`/leaderboard/team/${teamId}?cohortId=${cohortId}`),
    enabled: !!cohortId && !!teamId,
  });
}

export function useUpdateLeaderboardConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, config }: { cohortId: string; config: Partial<LeaderboardConfig> }) =>
      api.patch(`/admin/leaderboard/config/${cohortId}`, config),
    onSuccess: (_, { cohortId }) => {
      queryClient.invalidateQueries({ queryKey: leaderboardKeys.config(cohortId) });
      queryClient.invalidateQueries({ queryKey: leaderboardKeys.all });
      toast.success("Leaderboard configuration updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update configuration");
    },
  });
}

export function useExportLeaderboard() {
  return useMutation({
    mutationFn: (params: LeaderboardQueryParams) =>
      api.get<string>(`/admin/leaderboard/export?${buildQueryString(params)}`, {
        responseType: "blob" as any,
      }),
    onSuccess: (response, params) => {
      // Create download link
      const blob = new Blob([response as unknown as string], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leaderboard-${params.cohortId}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Leaderboard exported successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to export leaderboard");
    },
  });
}
