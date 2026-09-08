"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiClient } from "@/lib/api/client";

// Types
export type MentorStatus = "imported" | "active" | "inactive";

export interface Mentor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise: string[];
  calendlyLink?: string;
  linkedinUrl?: string;
  maxTeams: number;
  verticalScope: string[];
  status: MentorStatus;
  cohortId: string;
  assignments?: MentorAssignment[];
  createdAt: string;
}

export interface MentorAssignment {
  id: string;
  mentorId: string;
  teamId: string;
  team?: {
    id: string;
    name: string;
    status: string;
    brief?: {
      id: string;
      title: string;
      organization?: { name: string };
    };
    members?: Array<{
      id: string;
      participant: {
        firstName: string;
        lastName: string;
        email: string;
      };
      role: string;
    }>;
  };
  assignedAt: string;
  isActive: boolean;
}

export interface MentorSession {
  id: string;
  mentorId: string;
  teamId: string;
  team?: {
    id: string;
    name: string;
  };
  sessionDate: string;
  durationMinutes: number;
  notes?: string;
  topicsDiscussed: string[];
  actionItems: string[];
  teamProgressNotes?: string;
  nextSessionGoals?: string;
  sessionType: string;
  createdAt: string;
}

export interface MentorStatistics {
  total: number;
  active: number;
  inactive: number;
  imported: number;
  totalCapacity: number;
  assignedTeams: number;
  availableSlots: number;
  averageTeamsPerMentor: number;
  totalSessions: number;
  totalSessionHours: number;
}

export interface MentorCapacity {
  mentorId: string;
  mentorName: string;
  email: string;
  maxTeams: number;
  assignedTeams: number;
  availableSlots: number;
  verticalScope: string[];
  status: MentorStatus;
}

export interface CreateMentorDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise?: string[];
  calendlyLink?: string;
  linkedinUrl?: string;
  maxTeams?: number;
  verticalScope?: string[];
  cohortId: string;
}

export interface UpdateMentorDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise?: string[];
  calendlyLink?: string;
  linkedinUrl?: string;
  maxTeams?: number;
  verticalScope?: string[];
  status?: MentorStatus;
}

export interface CreateSessionDto {
  teamId: string;
  sessionDate: string;
  durationMinutes: number;
  notes?: string;
  topicsDiscussed?: string[];
  actionItems?: string[];
  teamProgressNotes?: string;
  nextSessionGoals?: string;
  sessionType?: string;
}

export interface MentorQueryParams {
  cohortId?: string;
  status?: MentorStatus;
  search?: string;
  verticalId?: string;
  hasCapacity?: boolean;
  page?: number;
  limit?: number;
}

// Query keys
const mentorKeys = {
  all: ["mentors"] as const,
  lists: () => [...mentorKeys.all, "list"] as const,
  list: (params: MentorQueryParams) => [...mentorKeys.lists(), params] as const,
  details: () => [...mentorKeys.all, "detail"] as const,
  detail: (id: string) => [...mentorKeys.details(), id] as const,
  statistics: (cohortId?: string) => [...mentorKeys.all, "statistics", cohortId] as const,
  capacity: (cohortId?: string) => [...mentorKeys.all, "capacity", cohortId] as const,
  teams: (mentorId: string) => [...mentorKeys.all, "teams", mentorId] as const,
  sessions: (mentorId: string, teamId?: string) =>
    [...mentorKeys.all, "sessions", mentorId, teamId] as const,
  suggest: (teamId: string) => [...mentorKeys.all, "suggest", teamId] as const,
  myProfile: () => [...mentorKeys.all, "my-profile"] as const,
  myTeams: () => [...mentorKeys.all, "my-teams"] as const,
  mySessions: (teamId?: string) => [...mentorKeys.all, "my-sessions", teamId] as const,
};

// ============ Admin Hooks ============

export function useMentors(params: MentorQueryParams = {}) {
  return useQuery({
    queryKey: mentorKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params.status) searchParams.set("status", params.status);
      if (params.search) searchParams.set("search", params.search);
      if (params.verticalId) searchParams.set("verticalId", params.verticalId);
      if (params.hasCapacity !== undefined)
        searchParams.set("hasCapacity", String(params.hasCapacity));
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));

      return api.get<{
        data: Mentor[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/mentors?${searchParams}`);
    },
  });
}

export function useMentor(id: string) {
  return useQuery({
    queryKey: mentorKeys.detail(id),
    queryFn: () => api.get<Mentor>(`/mentors/${id}`),
    enabled: !!id,
  });
}

export function useMentorStatistics(cohortId?: string) {
  return useQuery({
    queryKey: mentorKeys.statistics(cohortId),
    queryFn: () => {
      const url = cohortId ? `/mentors/statistics?cohortId=${cohortId}` : "/mentors/statistics";
      return api.get<MentorStatistics>(url);
    },
  });
}

export function useMentorCapacity(cohortId?: string) {
  return useQuery({
    queryKey: mentorKeys.capacity(cohortId),
    queryFn: () => {
      const url = cohortId ? `/mentors/capacity?cohortId=${cohortId}` : "/mentors/capacity";
      return api.get<MentorCapacity[]>(url);
    },
  });
}

export function useMentorTeams(mentorId: string) {
  return useQuery({
    queryKey: mentorKeys.teams(mentorId),
    queryFn: () => api.get<any[]>(`/mentors/${mentorId}/teams`),
    enabled: !!mentorId,
  });
}

export function useMentorSessions(mentorId: string, teamId?: string) {
  return useQuery({
    queryKey: mentorKeys.sessions(mentorId, teamId),
    queryFn: () => {
      const url = teamId
        ? `/mentors/${mentorId}/sessions?teamId=${teamId}`
        : `/mentors/${mentorId}/sessions`;
      return api.get<MentorSession[]>(url);
    },
    enabled: !!mentorId,
  });
}

export function useSuggestedMentors(teamId: string) {
  return useQuery({
    queryKey: mentorKeys.suggest(teamId),
    queryFn: () => api.get<Mentor[]>(`/mentors/team/${teamId}/suggest`),
    enabled: !!teamId,
  });
}

export function useCreateMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateMentorDto) => api.post<Mentor>("/mentors", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.statistics() });
    },
  });
}

export function useUpdateMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMentorDto }) =>
      api.patch<Mentor>(`/mentors/${id}`, dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
    },
  });
}

export function useDeleteMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/mentors/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.statistics() });
    },
  });
}

export function useAssignMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mentorId,
      teamId,
      notes,
    }: {
      mentorId: string;
      teamId: string;
      notes?: string;
    }) => api.post(`/mentors/${mentorId}/assign`, { teamId, notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.teams(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.capacity() });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUnassignMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mentorId,
      teamId,
      reason,
    }: {
      mentorId: string;
      teamId: string;
      reason?: string;
    }) => api.post(`/mentors/${mentorId}/unassign`, { teamId, reason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.teams(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.capacity() });
      // Invalidate all team queries to ensure the team detail page refreshes
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      // Also specifically invalidate the team detail
      queryClient.invalidateQueries({ queryKey: ["teams", "detail", variables.teamId] });
    },
  });
}

export function useBulkImportMentors() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cohortId, file }: { cohortId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      // Use apiClient for FormData upload
      const response = await apiClient.post<{
        success: number;
        failed: number;
        errors: Array<{ row: number; email?: string; error: string }>;
        imported: string[];
      }>(`/admin/mentors/import/${cohortId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.statistics() });
    },
  });
}

// ============ Mentor Portal Hooks ============

export function useCurrentMentor() {
  return useQuery({
    queryKey: mentorKeys.myProfile(),
    queryFn: () => api.get<Mentor>("/mentor-portal/me"),
  });
}

// Alias for backward compatibility
export function useMyMentorProfile() {
  return useCurrentMentor();
}

export function useUpdateMyMentorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateMentorDto) =>
      api.patch<Mentor>("/mentor-portal/me", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.myProfile() });
    },
  });
}

export function useMyMentorTeams() {
  return useQuery({
    queryKey: mentorKeys.myTeams(),
    queryFn: () => api.get<any[]>("/mentor-portal/my/teams"),
  });
}

export function useMyMentorSessions(teamId?: string) {
  return useQuery({
    queryKey: mentorKeys.mySessions(teamId),
    queryFn: () => {
      const url = teamId
        ? `/mentor-portal/my/sessions?teamId=${teamId}`
        : "/mentor-portal/my/sessions";
      return api.get<MentorSession[]>(url);
    },
  });
}

export function useLogMentorSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateSessionDto) =>
      api.post<MentorSession>("/mentor-portal/my/sessions", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.mySessions() });
    },
  });
}

// ============ Profile Picture Upload ============

export interface UploadResult {
  url: string;
  key: string;
}

export function useUploadMentorProfilePicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mentorId, file }: { mentorId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/mentors/${mentorId}/profile-picture`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "Failed to upload profile picture");
      }

      return response.json() as Promise<Mentor>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
    },
  });
}

export function useUploadMentorProfilePictureForNew() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/mentors/upload-profile-picture`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "Failed to upload profile picture");
      }

      return response.json() as Promise<UploadResult>;
    },
  });
}
