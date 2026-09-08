"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// Types
export interface Vertical {
  id: string;
  name: string;
  description?: string;
  cohortId: string;
  briefCap: number;
  briefCount: number;
  displayOrder: number;
  isActive: boolean;
  remainingCapacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVerticalDto {
  name: string;
  description?: string;
  cohortId: string;
  briefCap?: number;
  displayOrder?: number;
}

export interface UpdateVerticalDto {
  name?: string;
  description?: string;
  briefCap?: number;
  displayOrder?: number;
}

export interface BulkCreateVerticalsDto {
  cohortId: string;
  names: string[];
  defaultBriefCap?: number;
}

// Query keys
export const verticalKeys = {
  all: ["verticals"] as const,
  lists: () => [...verticalKeys.all, "list"] as const,
  list: (cohortId?: string) => [...verticalKeys.lists(), { cohortId }] as const,
  details: () => [...verticalKeys.all, "detail"] as const,
  detail: (id: string) => [...verticalKeys.details(), id] as const,
  myVerticals: () => [...verticalKeys.all, "my-verticals"] as const,
};

// Hooks
export function useVerticals(cohortId?: string) {
  return useQuery({
    queryKey: verticalKeys.list(cohortId),
    queryFn: async () => {
      // Use the participant-accessible endpoint via briefs
      const url = cohortId ? `/briefs/verticals/${cohortId}` : "/verticals";
      return api.get<Vertical[]>(url);
    },
    enabled: !!cohortId,
  });
}

/**
 * Hook for organization users to fetch verticals for their assigned cohort.
 * Uses the /organizations/me/verticals endpoint which doesn't require admin roles.
 */
export function useMyOrganizationVerticals() {
  return useQuery({
    queryKey: verticalKeys.myVerticals(),
    queryFn: async () => {
      return api.get<Vertical[]>("/organizations/me/verticals");
    },
  });
}

export function useVertical(id: string) {
  return useQuery({
    queryKey: verticalKeys.detail(id),
    queryFn: async () => {
      return api.get<Vertical>(`/verticals/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateVertical() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVerticalDto) => {
      return api.post<Vertical>("/verticals", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: verticalKeys.list(data.cohortId) });
      toast.success("Vertical created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create vertical");
    },
  });
}

export function useBulkCreateVerticals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkCreateVerticalsDto) => {
      return api.post<Vertical[]>("/verticals/bulk", data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: verticalKeys.list(variables.cohortId) });
      toast.success(`${data.length} verticals created successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create verticals");
    },
  });
}

export function useUpdateVertical() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateVerticalDto }) => {
      return api.patch<Vertical>(`/verticals/${id}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: verticalKeys.list(data.cohortId) });
      queryClient.setQueryData(verticalKeys.detail(data.id), data);
      toast.success("Vertical updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update vertical");
    },
  });
}

export function useReorderVerticals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cohortId, verticalIds }: { cohortId: string; verticalIds: string[] }) => {
      return api.post<Vertical[]>("/verticals/reorder", { cohortId, verticalIds });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: verticalKeys.list(variables.cohortId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reorder verticals");
    },
  });
}

export function useDeactivateVertical() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.patch<Vertical>(`/verticals/${id}/deactivate`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: verticalKeys.list(data.cohortId) });
      toast.success("Vertical deactivated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deactivate vertical");
    },
  });
}

export function useDeleteVertical() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cohortId }: { id: string; cohortId: string }) => {
      await api.delete(`/verticals/${id}`);
      return { cohortId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: verticalKeys.list(data.cohortId) });
      toast.success("Vertical deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete vertical");
    },
  });
}
