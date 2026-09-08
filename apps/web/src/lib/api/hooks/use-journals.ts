"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

export interface JournalEntry {
  id: string;
  teamId: string;
  cohortId: string;
  authorId: string;
  weekNumber: number;
  title?: string;
  content: string;
  highlights?: string[];
  challenges?: string[];
  nextWeekGoals?: string[];
  status: "draft" | "published";
  editableUntil: string;
  canEdit: boolean;
  hoursRemainingToEdit: number;
  lastEditedAt?: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  team?: {
    id: string;
    name: string;
  };
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateJournalInput {
  weekNumber: number;
  title?: string;
  content: string;
  highlights?: string[];
  challenges?: string[];
  nextWeekGoals?: string[];
  status?: "draft" | "published";
}

export interface UpdateJournalInput {
  title?: string;
  content?: string;
  highlights?: string[];
  challenges?: string[];
  nextWeekGoals?: string[];
  status?: "draft" | "published";
}

// Query keys
export const journalKeys = {
  all: ["journals"] as const,
  my: () => [...journalKeys.all, "my"] as const,
  myWeek: (weekNumber: number) => [...journalKeys.my(), weekNumber] as const,
  detail: (id: string) => [...journalKeys.all, "detail", id] as const,
  admin: () => [...journalKeys.all, "admin"] as const,
  adminList: (params?: Record<string, unknown>) => [...journalKeys.admin(), params] as const,
  team: (teamId: string) => [...journalKeys.admin(), "team", teamId] as const,
  weekSummary: (cohortId: string, weekNumber: number) => [...journalKeys.admin(), "summary", cohortId, weekNumber] as const,
};

// Get my team's journal entries
export function useMyJournals() {
  return useQuery({
    queryKey: journalKeys.my(),
    queryFn: () => api.get<JournalEntry[]>("/journals/my"),
  });
}

// Get my team's entry for a specific week
export function useMyJournalForWeek(weekNumber: number) {
  return useQuery({
    queryKey: journalKeys.myWeek(weekNumber),
    queryFn: () => api.get<JournalEntry | null>(`/journals/my/week/${weekNumber}`),
    enabled: !!weekNumber,
  });
}

// Get single journal entry
export function useJournal(id: string) {
  return useQuery({
    queryKey: journalKeys.detail(id),
    queryFn: () => api.get<JournalEntry>(`/journals/${id}`),
    enabled: !!id,
  });
}

// Create journal entry
export function useCreateJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJournalInput) => api.post<JournalEntry>("/journals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalKeys.my() });
      toast.success("Journal entry created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create journal entry");
    },
  });
}

// Update journal entry
export function useUpdateJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateJournalInput }) =>
      api.patch<JournalEntry>(`/journals/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: journalKeys.my() });
      queryClient.setQueryData(journalKeys.detail(data.id), data);
      toast.success("Journal entry updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update journal entry");
    },
  });
}

// Delete journal entry
export function useDeleteJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/journals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalKeys.my() });
      toast.success("Journal entry deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete journal entry");
    },
  });
}

// Admin: Get all journals with filters
export function useAdminJournals(params?: {
  teamId?: string;
  cohortId?: string;
  weekNumber?: number;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: journalKeys.adminList(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.teamId) searchParams.set("teamId", params.teamId);
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.weekNumber) searchParams.set("weekNumber", params.weekNumber.toString());
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return api.get<{ entries: JournalEntry[]; total: number; page: number; limit: number }>(
        `/admin/journals${query ? `?${query}` : ""}`
      );
    },
  });
}

// Admin: Get team's journals
export function useTeamJournals(teamId: string) {
  return useQuery({
    queryKey: journalKeys.team(teamId),
    queryFn: () => api.get<JournalEntry[]>(`/admin/journals/team/${teamId}`),
    enabled: !!teamId,
  });
}

// Admin: Get cohort week summary
export function useCohortWeekSummary(cohortId: string, weekNumber: number) {
  return useQuery({
    queryKey: journalKeys.weekSummary(cohortId, weekNumber),
    queryFn: () =>
      api.get<{ totalTeams: number; entriesSubmitted: number; missingTeams: string[] }>(
        `/admin/journals/cohort/${cohortId}/week/${weekNumber}/summary`
      ),
    enabled: !!cohortId && !!weekNumber,
  });
}
