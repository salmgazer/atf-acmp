"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// Types
export type BriefStatus = 
  | "draft" 
  | "submitted" 
  | "in_review" 
  | "approved" 
  | "rejected" 
  | "revision_requested";

export interface BriefResource {
  name: string;
  url: string;
  type: string;
}

export interface Brief {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  expectedOutcomes: string;
  status: BriefStatus;
  cohortId: string;
  organizationId: string;
  verticalId?: string;
  vertical?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  tags: string[];
  resources?: BriefResource[];
  videoUrl?: string;
  videoThumbnailUrl?: string;
  imageUrls: string[];
  maxTeams: number;
  teamsCount: number;
  reviewFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BriefRevision {
  id: string;
  briefId: string;
  action: string;
  actorId?: string;
  actorName?: string;
  comment?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  createdAt: string;
}

export interface CreateBriefDto {
  title: string;
  description: string;
  problemStatement: string;
  expectedOutcomes: string;
  cohortId: string;
  organizationId: string;
  verticalId?: string;
  tags?: string[];
  resources?: BriefResource[];
  maxTeams?: number;
}

export interface UpdateBriefDto {
  title?: string;
  description?: string;
  problemStatement?: string;
  expectedOutcomes?: string;
  verticalId?: string;
  tags?: string[];
  resources?: BriefResource[];
  maxTeams?: number;
  videoUrl?: string;
  imageUrls?: string[];
}

export interface ReviewBriefDto {
  action: "approved" | "rejected" | "revision_requested";
  feedback: string;
  reviewedBy?: string;
}

export interface BriefQueryParams {
  cohortId?: string;
  organizationId?: string;
  verticalId?: string;
  status?: BriefStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedBriefs {
  data: Brief[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BriefStatistics {
  total: number;
  draft: number;
  submitted: number;
  inReview: number;
  approved: number;
  rejected: number;
  revisionRequested: number;
}

// Query keys
export const briefKeys = {
  all: ["briefs"] as const,
  lists: () => [...briefKeys.all, "list"] as const,
  list: (params?: BriefQueryParams) => [...briefKeys.lists(), params] as const,
  approved: (cohortId: string, verticalId?: string, search?: string) => 
    [...briefKeys.all, "approved", cohortId, verticalId, search] as const,
  details: () => [...briefKeys.all, "detail"] as const,
  detail: (id: string) => [...briefKeys.details(), id] as const,
  revisions: (id: string) => [...briefKeys.detail(id), "revisions"] as const,
  statistics: (cohortId?: string) => [...briefKeys.all, "statistics", cohortId] as const,
};

// Hooks
export function useBriefs(params?: BriefQueryParams) {
  return useQuery({
    queryKey: briefKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.organizationId) searchParams.set("organizationId", params.organizationId);
      if (params?.verticalId) searchParams.set("verticalId", params.verticalId);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.search) searchParams.set("search", params.search);
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));

      return api.get<PaginatedBriefs>(`/briefs?${searchParams.toString()}`);
    },
  });
}

export function useApprovedBriefs(cohortId: string, verticalId?: string, search?: string) {
  return useQuery({
    queryKey: briefKeys.approved(cohortId, verticalId, search),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("cohortId", cohortId);
      if (verticalId) searchParams.set("verticalId", verticalId);
      if (search) searchParams.set("search", search);

      return api.get<Brief[]>(`/briefs/approved?${searchParams.toString()}`);
    },
    enabled: !!cohortId,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching to prevent UI flicker
  });
}

export function useBrief(id: string) {
  return useQuery({
    queryKey: briefKeys.detail(id),
    queryFn: () => api.get<Brief>(`/briefs/${id}`),
    enabled: !!id,
  });
}

export function useBriefRevisions(id: string) {
  return useQuery({
    queryKey: briefKeys.revisions(id),
    queryFn: () => api.get<BriefRevision[]>(`/briefs/${id}/revisions`),
    enabled: !!id,
  });
}

export function useBriefStatistics(cohortId?: string | null) {
  return useQuery({
    queryKey: briefKeys.statistics(cohortId ?? undefined),
    queryFn: async (): Promise<BriefStatistics> => {
      const url = cohortId 
        ? `/briefs/statistics?cohortId=${cohortId}`
        : "/briefs/statistics";
      const result = await api.get<BriefStatistics>(url);
      return result ?? {
        total: 0,
        draft: 0,
        submitted: 0,
        inReview: 0,
        approved: 0,
        rejected: 0,
        revisionRequested: 0,
      };
    },
    enabled: !!cohortId,
  });
}

export function useCreateBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBriefDto) => api.post<Brief>("/briefs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: briefKeys.lists() });
      toast.success("Brief created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create brief");
    },
  });
}

export function useUpdateBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBriefDto }) => 
      api.patch<Brief>(`/briefs/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: briefKeys.lists() });
      queryClient.setQueryData(briefKeys.detail(data.id), data);
      toast.success("Brief updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update brief");
    },
  });
}

export function useSubmitBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      api.post<Brief>(`/briefs/${id}/submit`, { submissionNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: briefKeys.all });
      toast.success("Brief submitted for review");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit brief");
    },
  });
}

export function useStartBriefReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewerId }: { id: string; reviewerId?: string }) => {
      const url = reviewerId 
        ? `/briefs/${id}/start-review?reviewerId=${reviewerId}`
        : `/briefs/${id}/start-review`;
      return api.post<Brief>(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: briefKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start review");
    },
  });
}

export function useReviewBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewBriefDto }) => 
      api.post<Brief>(`/briefs/${id}/review`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: briefKeys.all });
      const actionLabel = data.status === "approved" ? "approved" : 
                         data.status === "rejected" ? "rejected" : "sent back for revision";
      toast.success(`Brief ${actionLabel}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to review brief");
    },
  });
}

export function useDeleteBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/briefs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: briefKeys.lists() });
      toast.success("Brief deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete brief");
    },
  });
}

export function useUploadBriefVideo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/briefs/upload-video`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload video");
      }

      return response.json() as Promise<{ url: string }>;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload video");
    },
  });
}

export function useUploadBriefVideoForExisting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      return api.post<{ url: string }>(`/briefs/${id}/upload-video`, formData);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: briefKeys.detail(variables.id) });
      toast.success("Video uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload video");
    },
  });
}
