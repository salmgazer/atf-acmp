"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// Types
export interface CohortDeadlines {
  teamFormationEnd?: string;
  briefSelectionEnd?: string;
  stage1End?: string;
  stage2End?: string;
  stage3End?: string;
  demoDay?: string;
}

export interface StageNames {
  stage1?: string;
  stage2?: string;
  stage3?: string;
  demoDay?: string;
}

export interface RubricCriteria {
  name: string;
  weight: number;
  description?: string;
}

export interface RubricConfig {
  criteria: RubricCriteria[];
}

export type CohortStatus = "draft" | "active" | "evaluation" | "completed" | "archived";

export interface Cohort {
  id: string;
  name: string;
  description?: string;
  status: CohortStatus;
  teamSizeMin: number;
  teamSizeMax: number;
  deadlines: CohortDeadlines;
  stageNames?: StageNames;
  rubric?: RubricConfig;
  countries: string[];
  verticals: string[];
  briefCap: number;
  maxTeamsPerBrief: number;
  sessionRate?: number; // Default rate paid per mentor session
  stageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCohortDto {
  name: string;
  description?: string;
  teamSizeMin?: number;
  teamSizeMax?: number;
  deadlines?: CohortDeadlines;
  stageNames?: StageNames;
  rubric?: RubricConfig;
  countries?: string[];
  verticals?: string[];
  briefCap?: number;
  maxTeamsPerBrief?: number;
  sessionRate?: number;
}

export interface UpdateCohortDto extends Partial<CreateCohortDto> {}

export interface CohortQueryParams {
  status?: CohortStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CohortStatistics {
  participantCount: number;
  teamCount: number;
  briefCount: number;
  organizationCount: number;
  participantsWithoutTeam: number;
}

// Query keys
export const cohortKeys = {
  all: ["cohorts"] as const,
  lists: () => [...cohortKeys.all, "list"] as const,
  list: (params: CohortQueryParams) => [...cohortKeys.lists(), params] as const,
  details: () => [...cohortKeys.all, "detail"] as const,
  detail: (id: string) => [...cohortKeys.details(), id] as const,
  active: () => [...cohortKeys.all, "active"] as const,
  statistics: (id: string) => [...cohortKeys.detail(id), "statistics"] as const,
};

// Hooks
export function useCohorts(params: CohortQueryParams = {}) {
  return useQuery({
    queryKey: cohortKeys.list(params),
    queryFn: async (): Promise<PaginatedResponse<Cohort>> => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set("status", params.status);
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());

      const query = searchParams.toString();
      const result = await api.get<PaginatedResponse<Cohort>>(
        `/cohorts${query ? `?${query}` : ""}`
      );
      return result ?? { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
    },
  });
}

export function useCohort(id: string) {
  return useQuery({
    queryKey: cohortKeys.detail(id),
    queryFn: () => api.get<Cohort>(`/cohorts/${id}`),
    enabled: !!id,
  });
}

export function useActiveCohort() {
  return useQuery({
    queryKey: cohortKeys.active(),
    queryFn: async (): Promise<Cohort | null> => {
      const result = await api.get<Cohort | null>("/cohorts/active");
      return result ?? null;
    },
  });
}

export function useCohortStatistics(id: string) {
  return useQuery({
    queryKey: cohortKeys.statistics(id),
    queryFn: async (): Promise<CohortStatistics> => {
      const result = await api.get<CohortStatistics>(`/cohorts/${id}/statistics`);
      return result ?? { participantCount: 0, teamCount: 0, briefCount: 0, organizationCount: 0, participantsWithoutTeam: 0 };
    },
    enabled: !!id,
  });
}

export function useCreateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCohortDto) => {
      return api.post<Cohort>("/cohorts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cohortKeys.lists() });
      toast.success("Cohort created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create cohort");
    },
  });
}

export function useUpdateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCohortDto }) => {
      return api.patch<Cohort>(`/cohorts/${id}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cohortKeys.lists() });
      queryClient.setQueryData(cohortKeys.detail(data.id), data);
      toast.success("Cohort updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update cohort");
    },
  });
}

export function useUpdateCohortStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CohortStatus }) => {
      return api.patch<Cohort>(`/cohorts/${id}/status`, { status });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cohortKeys.lists() });
      queryClient.invalidateQueries({ queryKey: cohortKeys.active() });
      queryClient.setQueryData(cohortKeys.detail(data.id), data);
      toast.success(`Cohort status updated to ${data.status}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update cohort status");
    },
  });
}

export function useDuplicateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return api.post<Cohort>(`/cohorts/${id}/duplicate`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cohortKeys.lists() });
      toast.success("Cohort duplicated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to duplicate cohort");
    },
  });
}

export function useDeleteCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cohorts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cohortKeys.lists() });
      toast.success("Cohort deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete cohort");
    },
  });
}
