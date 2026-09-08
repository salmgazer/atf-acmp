"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

export interface StageRequirements {
  documentRequired?: boolean;
  documentMaxSize?: number;
  documentTypes?: string[];
  videoRequired?: boolean;
  videoMaxDuration?: number;
  videoMaxSize?: number;
  urlRequired?: boolean;
  urlLabel?: string;
  githubRequired?: boolean;
  textRequired?: boolean;
  textLabel?: string;
  textMinLength?: number;
  textMaxLength?: number;
  additionalFields?: Array<{
    name: string;
    label: string;
    type: "text" | "textarea" | "url";
    required: boolean;
    placeholder?: string;
  }>;
}

export interface Stage {
  id: string;
  cohortId: string;
  number: number;
  name: string;
  description?: string;
  instructions?: string;
  type: "document" | "video" | "url" | "text" | "mixed";
  startDate?: string;
  deadline: string;
  requirements: StageRequirements;
  weightPercentage: number;
  isActive: boolean;
  allowLateSubmissions: boolean;
  latePenaltyPercentage: number;
  sortOrder: number;
  isOpen?: boolean;
  isPastDeadline?: boolean;
  stats?: {
    draft: number;
    submitted: number;
    late: number;
    evaluated: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateStageInput {
  cohortId: string;
  number: number;
  name: string;
  description?: string;
  instructions?: string;
  type: Stage["type"];
  startDate?: string;
  deadline: string;
  requirements?: StageRequirements;
  weightPercentage?: number;
  allowLateSubmissions?: boolean;
  latePenaltyPercentage?: number;
  sortOrder?: number;
}

export interface UpdateStageInput {
  number?: number;
  name?: string;
  description?: string;
  instructions?: string;
  type?: Stage["type"];
  startDate?: string;
  deadline?: string;
  requirements?: StageRequirements;
  weightPercentage?: number;
  isActive?: boolean;
  allowLateSubmissions?: boolean;
  latePenaltyPercentage?: number;
  sortOrder?: number;
}

// Query keys
export const stageKeys = {
  all: ["stages"] as const,
  lists: () => [...stageKeys.all, "list"] as const,
  list: (cohortId?: string, activeOnly?: boolean) => [...stageKeys.lists(), { cohortId, activeOnly }] as const,
  details: () => [...stageKeys.all, "detail"] as const,
  detail: (id: string) => [...stageKeys.details(), id] as const,
  withStats: (cohortId: string) => [...stageKeys.all, "stats", cohortId] as const,
};

// Get all stages (with optional cohort filter)
export function useStages(cohortId?: string, activeOnly?: boolean) {
  return useQuery({
    queryKey: stageKeys.list(cohortId, activeOnly),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cohortId) params.set("cohortId", cohortId);
      if (activeOnly) params.set("activeOnly", "true");
      const query = params.toString();
      return api.get<Stage[]>(`/stages${query ? `?${query}` : ""}`);
    },
  });
}

// Get single stage
export function useStage(id: string) {
  return useQuery({
    queryKey: stageKeys.detail(id),
    queryFn: async () => {
      return api.get<Stage>(`/stages/${id}`);
    },
    enabled: !!id,
  });
}

// Get stages with stats (admin)
export function useStagesWithStats(cohortId: string) {
  return useQuery({
    queryKey: stageKeys.withStats(cohortId),
    queryFn: async () => {
      return api.get<Stage[]>(`/admin/stages/cohort/${cohortId}/stats`);
    },
    enabled: !!cohortId,
  });
}

// Create stage
export function useCreateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStageInput) => {
      return api.post<Stage>("/admin/stages", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: stageKeys.withStats(variables.cohortId) });
      toast.success("Stage created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create stage");
    },
  });
}

// Update stage
export function useUpdateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStageInput }) => {
      return api.patch<Stage>(`/admin/stages/${id}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: stageKeys.withStats(data.cohortId) });
      queryClient.setQueryData(stageKeys.detail(data.id), data);
      toast.success("Stage updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update stage");
    },
  });
}

// Delete stage
export function useDeleteStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/stages/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stageKeys.lists() });
      toast.success("Stage deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete stage");
    },
  });
}
