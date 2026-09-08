"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// Types
export type StaffRole = "super_admin" | "program_manager" | "evaluator" | "viewer";

export interface Staff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  isActive: boolean;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface StaffQueryParams {
  role?: StaffRole;
  search?: string;
  isActive?: boolean;
}

export interface CreateStaffDto {
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
}

export interface UpdateStaffDto {
  firstName?: string;
  lastName?: string;
  role?: StaffRole;
  isActive?: boolean;
}

export interface StaffStatistics {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
}

// Query keys
export const staffKeys = {
  all: ["staff"] as const,
  lists: () => [...staffKeys.all, "list"] as const,
  list: (params: StaffQueryParams) => [...staffKeys.lists(), params] as const,
  details: () => [...staffKeys.all, "detail"] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
  statistics: () => [...staffKeys.all, "statistics"] as const,
};

// Role display helpers
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  program_manager: "Program Manager",
  evaluator: "Evaluator",
  viewer: "Viewer",
};

export const STAFF_ROLE_COLORS: Record<StaffRole, string> = {
  super_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  program_manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  evaluator: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

// Hooks
export function useStaff(params: StaffQueryParams = {}) {
  return useQuery({
    queryKey: staffKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.role) searchParams.set("role", params.role);
      if (params.search) searchParams.set("search", params.search);
      if (params.isActive !== undefined) searchParams.set("isActive", String(params.isActive));

      return api.get<Staff[]>(`/admin/staff?${searchParams}`);
    },
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: staffKeys.detail(id),
    queryFn: () => api.get<Staff>(`/admin/staff/${id}`),
    enabled: !!id,
  });
}

export function useStaffStatistics() {
  return useQuery({
    queryKey: staffKeys.statistics(),
    queryFn: () => api.get<StaffStatistics>("/admin/staff/statistics"),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateStaffDto) => api.post<Staff>("/admin/staff", dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.statistics() });
      toast.success(`Staff member ${data.firstName} ${data.lastName} created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create staff member");
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStaffDto }) =>
      api.patch<Staff>(`/admin/staff/${id}`, dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.statistics() });
      toast.success("Staff member updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update staff member");
    },
  });
}

export function useDeactivateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Staff>(`/admin/staff/${id}/deactivate`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.statistics() });
      toast.success("Staff member deactivated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deactivate staff member");
    },
  });
}

export function useActivateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Staff>(`/admin/staff/${id}/activate`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.statistics() });
      toast.success("Staff member activated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to activate staff member");
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/staff/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.statistics() });
      toast.success("Staff member deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete staff member");
    },
  });
}

export function useResendStaffInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<{ message: string }>(`/admin/staff/${id}/resend-invite`),
    onSuccess: () => {
      toast.success("Invitation email sent");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation email");
    },
  });
}
