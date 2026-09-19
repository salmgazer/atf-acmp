"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

// ============ Types ============

export interface ActivityStatsQueryParams {
  cohortId?: string;
  portal?: "staff" | "participant" | "organization" | "mentor" | "public";
  startDate?: string;
  endDate?: string;
}

export interface HourlyActivityPoint {
  hour: number; // 0-23
  count: number;
  uniqueUsers: number;
}

export interface DailyActivityPoint {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayName: string; // Sunday, Monday, etc.
  count: number;
  uniqueUsers: number;
}

export interface HourlyActivityTrend {
  data: HourlyActivityPoint[];
  totalRequests: number;
  peakHour: number;
  peakHourCount: number;
}

export interface WeeklyActivityTrend {
  data: DailyActivityPoint[];
  totalRequests: number;
  totalUniqueUsers: number;
  averageDaily: number;
  peakDay: string;
  peakDayCount: number;
}

export interface ActivityStats {
  hourlyTrend: HourlyActivityTrend;
  weeklyTrend: WeeklyActivityTrend;
  topEndpoints: Array<{ path: string; method: string; count: number }>;
  activityByType: Record<string, number>;
  activityByPortal: Record<string, number>;
}

// ============ Query Keys ============

export const activityKeys = {
  all: ["activity"] as const,
  hourly: (params?: ActivityStatsQueryParams) => [...activityKeys.all, "hourly", params] as const,
  weekly: (params?: ActivityStatsQueryParams) => [...activityKeys.all, "weekly", params] as const,
  stats: (params?: ActivityStatsQueryParams) => [...activityKeys.all, "stats", params] as const,
  topEndpoints: (params?: ActivityStatsQueryParams) => [...activityKeys.all, "topEndpoints", params] as const,
};

// ============ Utility ============

function buildQueryString(params?: ActivityStatsQueryParams): string {
  if (!params) return "";
  
  const searchParams = new URLSearchParams();
  if (params.cohortId) searchParams.set("cohortId", params.cohortId);
  if (params.portal) searchParams.set("portal", params.portal);
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

// ============ Hooks ============

/**
 * Fetch hourly activity trend (last 24 hours)
 */
export function useHourlyActivity(params?: ActivityStatsQueryParams) {
  return useQuery({
    queryKey: activityKeys.hourly(params),
    queryFn: () => api.get<HourlyActivityTrend>(`/admin/activity/hourly${buildQueryString(params)}`),
    // Refetch every 5 minutes to keep data fresh
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });
}

/**
 * Fetch weekly activity trend (last 7 days)
 */
export function useWeeklyActivity(params?: ActivityStatsQueryParams) {
  return useQuery({
    queryKey: activityKeys.weekly(params),
    queryFn: () => api.get<WeeklyActivityTrend>(`/admin/activity/weekly${buildQueryString(params)}`),
    // Refetch every 5 minutes
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch combined activity statistics
 */
export function useActivityStats(params?: ActivityStatsQueryParams) {
  return useQuery({
    queryKey: activityKeys.stats(params),
    queryFn: () => api.get<ActivityStats>(`/admin/activity/stats${buildQueryString(params)}`),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch top endpoints
 */
export function useTopEndpoints(params?: ActivityStatsQueryParams) {
  return useQuery({
    queryKey: activityKeys.topEndpoints(params),
    queryFn: () => api.get<Array<{ path: string; method: string; count: number }>>(`/admin/activity/top-endpoints${buildQueryString(params)}`),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}
