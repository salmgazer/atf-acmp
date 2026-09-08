"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// ============ Types ============

export interface DashboardQueryParams {
  cohortId: string;
  startDate?: string;
  endDate?: string;
  verticalId?: string;
  country?: string;
}

export interface OverviewMetrics {
  totalTeams: number;
  activeTeams: number;
  submittedTeams: number;
  evaluatedTeams: number;
  disqualifiedTeams: number;
  totalParticipants: number;
  totalMentors: number;
  totalOrganizations: number;
  submissionRate: number;
  averageTeamSize: number;
  dropoutRate: number;
}

export interface TeamsByStatus {
  forming: number;
  active: number;
  submitted: number;
  evaluated: number;
  disqualified: number;
}

export interface TeamsByVertical {
  verticalId: string;
  verticalName: string;
  count: number;
  percentage: number;
}

export interface TeamsByCountry {
  country: string;
  count: number;
  percentage: number;
}

export interface TeamStatistics {
  byStatus: TeamsByStatus;
  byVertical: TeamsByVertical[];
  byCountry: TeamsByCountry[];
  teamSizeDistribution: Array<{ size: number; count: number }>;
  registrationTrend: Array<{ date: string; count: number }>;
}

export interface StageSubmissionStats {
  stageId: string;
  stageName: string;
  stageNumber: number;
  totalTeams: number;
  submitted: number;
  late: number;
  pending: number;
  submissionRate: number;
  averageScore: number | null;
}

export interface SubmissionStatistics {
  byStage: StageSubmissionStats[];
  overallSubmissionRate: number;
  lateSubmissionRate: number;
  submissionTrend: Array<{ date: string; count: number }>;
}

export interface EvaluationStatistics {
  totalEvaluated: number;
  pendingEvaluation: number;
  averageAIScore: number;
  averageHumanScore: number;
  averageFinalScore: number;
  scoreDistribution: Array<{ range: string; count: number }>;
  byStage: Array<{
    stageId: string;
    stageName: string;
    evaluated: number;
    averageScore: number;
  }>;
}

export interface PerformanceHeatmapData {
  verticalId: string;
  verticalName: string;
  country: string;
  teamCount: number;
  averageScore: number;
  submissionRate: number;
}

export interface PerformanceHeatmap {
  data: PerformanceHeatmapData[];
}

// ============ Query Keys ============

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: (params: DashboardQueryParams) => [...dashboardKeys.all, "overview", params] as const,
  teams: (params: DashboardQueryParams) => [...dashboardKeys.all, "teams", params] as const,
  submissions: (params: DashboardQueryParams) => [...dashboardKeys.all, "submissions", params] as const,
  evaluations: (params: DashboardQueryParams) => [...dashboardKeys.all, "evaluations", params] as const,
  heatmap: (params: DashboardQueryParams) => [...dashboardKeys.all, "heatmap", params] as const,
};

// ============ Utility ============

function buildQueryString(params: DashboardQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("cohortId", params.cohortId);
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);
  if (params.verticalId) searchParams.set("verticalId", params.verticalId);
  if (params.country) searchParams.set("country", params.country);
  return searchParams.toString();
}

// ============ Hooks ============

export function useDashboardOverview(params: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.overview(params),
    queryFn: () => api.get<OverviewMetrics>(`/admin/dashboard/overview?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}

export function useDashboardTeams(params: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.teams(params),
    queryFn: () => api.get<TeamStatistics>(`/admin/dashboard/teams?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}

export function useDashboardSubmissions(params: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.submissions(params),
    queryFn: () => api.get<SubmissionStatistics>(`/admin/dashboard/submissions?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}

export function useDashboardEvaluations(params: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.evaluations(params),
    queryFn: () => api.get<EvaluationStatistics>(`/admin/dashboard/evaluations?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}

export function useDashboardHeatmap(params: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.heatmap(params),
    queryFn: () => api.get<PerformanceHeatmap>(`/admin/dashboard/heatmap?${buildQueryString(params)}`),
    enabled: !!params.cohortId,
  });
}
