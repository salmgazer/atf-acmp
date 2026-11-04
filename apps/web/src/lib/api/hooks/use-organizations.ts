"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// Types
export type PartnerStatus = "pending" | "approved" | "rejected";

export interface PartnerCohort {
  id: string;
  name: string;
  description?: string;
  status: string;
  deadlines?: {
    teamFormationEnd?: string;
    briefSelectionEnd?: string;
    stage1End?: string;
    stage2End?: string;
    stage3End?: string;
    demoDay?: string;
  };
}

export interface Partner {
  id: string;
  name: string;
  email: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  status: PartnerStatus;
  isActive: boolean;
  approvedAt?: string;
  rejectionReason?: string;
  cohortId?: string;
  cohort?: PartnerCohort;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartnerDto {
  name: string;
  email: string;
  website?: string;
  description?: string;
  industry?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  cohortId?: string;
}

export interface UpdatePartnerDto {
  name?: string;
  website?: string;
  description?: string;
  industry?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  logoUrl?: string;
  cohortId?: string;
}

// Bulk Import Types
export interface BulkImportPartnerRow {
  name: string;
  email: string;
  contactPerson?: string;
  contactPhone?: string;
  country?: string;
  industry?: string;
  website?: string;
  description?: string;
  cohortId?: string;
}

export interface ImportResult {
  success: boolean;
  email: string;
  name: string;
  error?: string;
  organizationId?: string;
}

export interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: ImportResult[];
}

// Invite Types
export interface InviteResult {
  organizationId: string;
  email: string;
  success: boolean;
  error?: string;
}

export interface BulkInviteResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: InviteResult[];
}

export interface PartnerQueryParams {
  status?: PartnerStatus;
  search?: string;
  country?: string;
  cohortId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPartners {
  data: Partner[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PartnerStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// Query keys
export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  list: (params?: PartnerQueryParams) => [...organizationKeys.lists(), params] as const,
  details: () => [...organizationKeys.all, "detail"] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  statistics: () => [...organizationKeys.all, "statistics"] as const,
  current: () => [...organizationKeys.all, "current"] as const,
};

// Hooks
export function usePartners(params?: PartnerQueryParams) {
  return useQuery({
    queryKey: organizationKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.search) searchParams.set("search", params.search);
      if (params?.country) searchParams.set("country", params.country);
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));

      return api.get<PaginatedPartners>(`/organizations?${searchParams.toString()}`);
    },
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => api.get<Partner>(`/organizations/${id}`),
    enabled: !!id,
  });
}

export function useCurrentPartner() {
  return useQuery({
    queryKey: organizationKeys.current(),
    queryFn: () => api.get<Partner>("/organizations/me"),
  });
}

export function usePartnerStatistics() {
  return useQuery({
    queryKey: organizationKeys.statistics(),
    queryFn: async (): Promise<PartnerStatistics> => {
      const result = await api.get<PartnerStatistics>("/organizations/statistics");
      return result ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
    },
  });
}

export function useRegisterPartner(options?: { successMessage?: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePartnerDto) => api.post<Partner>("/organizations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success(options?.successMessage || "Registration submitted successfully! We'll review your application shortly.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to register organization");
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePartnerDto }) =>
      api.patch<Partner>(`/organizations/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.setQueryData(organizationKeys.detail(data.id), data);
      toast.success("Partner updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update organization");
    },
  });
}

export function useApprovePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy?: string }) =>
      api.post<Partner>(`/organizations/${id}/approve`, { approvedBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Partner approved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve organization");
    },
  });
}

export function useRejectPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Partner>(`/organizations/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Partner rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject organization");
    },
  });
}

export function useUploadPartnerLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/organizations/${id}/logo/upload`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "Failed to upload logo");
      }

      return response.json() as Promise<Partner>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.current() });
      toast.success("Logo updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload logo");
    },
  });
}

// ============ Bulk Import Hooks ============

export function useBulkImportPartners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ organizations, cohortId }: { organizations: BulkImportPartnerRow[]; cohortId: string }) =>
      api.post<BulkImportResult>("/organizations/bulk-import", { organizations, cohortId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      if (data.failureCount === 0) {
        toast.success(`Successfully imported ${data.successCount} organizations`);
      } else {
        toast.warning(
          `Imported ${data.successCount} organizations, ${data.failureCount} failed`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import organizations");
    },
  });
}

// ============ Invite Hooks ============

export function useSendPartnerInvite() {
  return useMutation({
    mutationFn: ({ id, customMessage }: { id: string; customMessage?: string }) =>
      api.post<InviteResult>(`/organizations/${id}/send-invite`, { customMessage }),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Invite sent to ${data.email}`);
      } else {
        toast.error(`Failed to send invite: ${data.error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invite");
    },
  });
}

export function useBulkSendInvites() {
  return useMutation({
    mutationFn: ({
      organizationIds,
      customMessage,
    }: {
      organizationIds: string[];
      customMessage?: string;
    }) =>
      api.post<BulkInviteResult>("/organizations/bulk-send-invites", {
        organizationIds,
        customMessage,
      }),
    onSuccess: (data) => {
      if (data.failureCount === 0) {
        toast.success(`Successfully sent ${data.successCount} invites`);
      } else {
        toast.warning(
          `Sent ${data.successCount} invites, ${data.failureCount} failed`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invites");
    },
  });
}
