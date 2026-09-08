"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// ============ Types ============

export type AnnouncementAudience = "all" | "vertical" | "team" | "organization" | "mentor";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "archived";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  audienceValue?: string[] | null;
  status: AnnouncementStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  isPinned: boolean;
  readCount: number;
  cohortId: string;
  createdById: string;
  createdBy?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  audience?: AnnouncementAudience;
  audienceValue?: string[];
  cohortId: string;
  scheduledAt?: string;
  isPinned?: boolean;
  publishImmediately?: boolean;
}

export interface UpdateAnnouncementDto {
  title?: string;
  content?: string;
  audience?: AnnouncementAudience;
  audienceValue?: string[];
  scheduledAt?: string;
  isPinned?: boolean;
  status?: AnnouncementStatus;
}

export interface AnnouncementQueryParams {
  cohortId: string;
  status?: AnnouncementStatus;
  audience?: AnnouncementAudience;
  limit?: number;
  offset?: number;
}

// ============ Query Keys ============

export const announcementKeys = {
  all: ["announcements"] as const,
  admin: (params: AnnouncementQueryParams) => [...announcementKeys.all, "admin", params] as const,
  participant: (cohortId?: string) => [...announcementKeys.all, "participant", cohortId] as const,
  organization: (cohortId?: string) => [...announcementKeys.all, "organization", cohortId] as const,
  mentor: (cohortId?: string) => [...announcementKeys.all, "mentor", cohortId] as const,
  detail: (id: string) => [...announcementKeys.all, "detail", id] as const,
};

// ============ Admin Hooks ============

export function useAdminAnnouncements(params: AnnouncementQueryParams) {
  return useQuery({
    queryKey: announcementKeys.admin(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("cohortId", params.cohortId);
      if (params.status) searchParams.set("status", params.status);
      if (params.audience) searchParams.set("audience", params.audience);
      if (params.limit) searchParams.set("limit", params.limit.toString());
      if (params.offset) searchParams.set("offset", params.offset.toString());

      return api.get<{
        data: Announcement[];
        meta: { total: number; limit: number; offset: number };
      }>(`/admin/announcements?${searchParams.toString()}`);
    },
    enabled: !!params.cohortId,
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: () => api.get<Announcement>(`/admin/announcements/${id}`),
    enabled: !!id,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateAnnouncementDto) => api.post<Announcement>("/admin/announcements", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create announcement");
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAnnouncementDto }) =>
      api.patch<Announcement>(`/admin/announcements/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update announcement");
    },
  });
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Announcement>(`/admin/announcements/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement published");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to publish announcement");
    },
  });
}

export function useArchiveAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Announcement>(`/admin/announcements/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement archived");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to archive announcement");
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete announcement");
    },
  });
}

// ============ Participant/Org/Mentor Hooks ============

export function useParticipantAnnouncements(cohortId?: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: announcementKeys.participant(cohortId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (cohortId) searchParams.set("cohortId", cohortId);
      searchParams.set("limit", limit.toString());
      searchParams.set("offset", offset.toString());

      return api.get<{
        data: Announcement[];
        meta: { total: number; limit: number; offset: number };
      }>(`/announcements/participant?${searchParams.toString()}`);
    },
  });
}

export function useOrganizationAnnouncements(cohortId?: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: announcementKeys.organization(cohortId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (cohortId) searchParams.set("cohortId", cohortId);
      searchParams.set("limit", limit.toString());
      searchParams.set("offset", offset.toString());

      return api.get<{
        data: Announcement[];
        meta: { total: number; limit: number; offset: number };
      }>(`/announcements/organization?${searchParams.toString()}`);
    },
  });
}

export function useMentorAnnouncements(cohortId?: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: announcementKeys.mentor(cohortId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (cohortId) searchParams.set("cohortId", cohortId);
      searchParams.set("limit", limit.toString());
      searchParams.set("offset", offset.toString());

      return api.get<{
        data: Announcement[];
        meta: { total: number; limit: number; offset: number };
      }>(`/announcements/mentor?${searchParams.toString()}`);
    },
  });
}

export function useMarkAnnouncementRead() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/read`),
  });
}
