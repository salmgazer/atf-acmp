"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

export type ResourceType = "document" | "video" | "link" | "template";
export type ResourceVisibility = "all" | "vertical" | "staff";

export interface Resource {
  id: string;
  cohortId?: string;
  verticalId?: string;
  title: string;
  description?: string;
  type: ResourceType;
  fileUrl?: string;
  externalUrl?: string;
  videoEmbedUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  thumbnailUrl?: string;
  tags: string[];
  visibility: ResourceVisibility;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  downloadCount: number;
  viewCount: number;
  uploadedBy: string;
  accessUrl: string | null;
  createdAt: string;
  updatedAt: string;
  vertical?: {
    id: string;
    name: string;
  };
}

export interface CreateResourceInput {
  cohortId?: string;
  verticalId?: string;
  title: string;
  description?: string;
  type: ResourceType;
  fileUrl?: string;
  externalUrl?: string;
  videoEmbedUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  thumbnailUrl?: string;
  tags?: string[];
  visibility?: ResourceVisibility;
  isPublished?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export interface UpdateResourceInput extends Partial<CreateResourceInput> {}

export interface ResourceQuery {
  cohortId?: string;
  verticalId?: string;
  type?: ResourceType;
  tag?: string;
  search?: string;
  featuredOnly?: boolean;
  page?: number;
  limit?: number;
}

// Query keys
export const resourceKeys = {
  all: ["resources"] as const,
  lists: () => [...resourceKeys.all, "list"] as const,
  list: (query?: ResourceQuery) => [...resourceKeys.lists(), query] as const,
  detail: (id: string) => [...resourceKeys.all, "detail", id] as const,
  tags: (cohortId?: string) => [...resourceKeys.all, "tags", cohortId] as const,
  admin: () => [...resourceKeys.all, "admin"] as const,
  adminList: (query?: ResourceQuery) => [...resourceKeys.admin(), "list", query] as const,
  adminStats: (cohortId?: string) => [...resourceKeys.admin(), "stats", cohortId] as const,
};

// Get resources (for participants)
export function useResources(query?: ResourceQuery) {
  return useQuery({
    queryKey: resourceKeys.list(query),
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.cohortId) params.set("cohortId", query.cohortId);
      if (query?.verticalId) params.set("verticalId", query.verticalId);
      if (query?.type) params.set("type", query.type);
      if (query?.tag) params.set("tag", query.tag);
      if (query?.search) params.set("search", query.search);
      if (query?.featuredOnly) params.set("featuredOnly", "true");
      if (query?.page) params.set("page", query.page.toString());
      if (query?.limit) params.set("limit", query.limit.toString());
      const queryStr = params.toString();
      return api.get<{ resources: Resource[]; total: number; page: number; limit: number }>(
        `/resources${queryStr ? `?${queryStr}` : ""}`
      );
    },
  });
}

// Get single resource
export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKeys.detail(id),
    queryFn: () => api.get<Resource>(`/resources/${id}`),
    enabled: !!id,
  });
}

// Get all tags
export function useResourceTags(cohortId?: string) {
  return useQuery({
    queryKey: resourceKeys.tags(cohortId),
    queryFn: () => api.get<string[]>(`/resources/tags${cohortId ? `?cohortId=${cohortId}` : ""}`),
  });
}

// Track download
export function useTrackDownload() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/resources/${id}/download`),
  });
}

// Admin: Get resources
export function useAdminResources(query?: ResourceQuery) {
  return useQuery({
    queryKey: resourceKeys.adminList(query),
    queryFn: () => {
      const params = new URLSearchParams();
      if (query?.cohortId) params.set("cohortId", query.cohortId);
      if (query?.verticalId) params.set("verticalId", query.verticalId);
      if (query?.type) params.set("type", query.type);
      if (query?.tag) params.set("tag", query.tag);
      if (query?.search) params.set("search", query.search);
      if (query?.page) params.set("page", query.page.toString());
      if (query?.limit) params.set("limit", query.limit.toString());
      const queryStr = params.toString();
      return api.get<{ resources: Resource[]; total: number; page: number; limit: number }>(
        `/admin/resources${queryStr ? `?${queryStr}` : ""}`
      );
    },
  });
}

// Admin: Get stats
export function useResourceStats(cohortId?: string) {
  return useQuery({
    queryKey: resourceKeys.adminStats(cohortId),
    queryFn: () =>
      api.get<{ total: number; byType: { type: ResourceType; count: number }[]; totalDownloads: number; totalViews: number }>(
        `/admin/resources/stats${cohortId ? `?cohortId=${cohortId}` : ""}`
      ),
  });
}

// Admin: Create resource
export function useCreateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateResourceInput) => api.post<Resource>("/admin/resources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      toast.success("Resource created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create resource");
    },
  });
}

// Admin: Update resource
export function useUpdateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateResourceInput }) =>
      api.patch<Resource>(`/admin/resources/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      queryClient.setQueryData(resourceKeys.detail(data.id), data);
      toast.success("Resource updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update resource");
    },
  });
}

// Admin: Delete resource
export function useDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/resources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      toast.success("Resource deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete resource");
    },
  });
}
