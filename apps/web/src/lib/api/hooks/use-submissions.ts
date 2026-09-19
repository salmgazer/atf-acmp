"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";
import { Stage } from "./use-stages";

export interface FileUrl {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt?: string;
}

export interface Submission {
  id: string;
  teamId: string;
  stageId: string;
  status: "draft" | "submitted" | "late" | "pending_approval" | "approved" | "rejected" | "evaluated";
  content: Record<string, any>;
  fileUrls: FileUrl[];
  videoUrl?: string;
  submittedAt?: string;
  submittedBy?: string;
  isLate: boolean;
  lateMinutes: number;
  score?: number;
  evaluatedAt?: string;
  feedback?: {
    strengths?: string[];
    improvements?: string[];
    comments?: string;
  };
  // Approval fields
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  version: number;
  lastSavedAt?: string;
  createdAt: string;
  updatedAt: string;
  stage?: Stage;
  team?: {
    id: string;
    name: string;
    githubRepoUrl?: string;
  };
}

export interface SaveDraftInput {
  stageId: string;
  content?: Record<string, any>;
  fileUrls?: FileUrl[];
  videoUrl?: string;
}

export interface SubmitInput {
  stageId: string;
  content?: Record<string, any>;
  fileUrls?: FileUrl[];
  videoUrl?: string;
}

// Query keys
export const submissionKeys = {
  all: ["submissions"] as const,
  my: () => [...submissionKeys.all, "my"] as const,
  myStage: (stageId: string) => [...submissionKeys.my(), "stage", stageId] as const,
  detail: (id: string) => [...submissionKeys.all, "detail", id] as const,
  history: (id: string) => [...submissionKeys.detail(id), "history"] as const,
};

// Get all my team's submissions
export function useMySubmissions() {
  return useQuery({
    queryKey: submissionKeys.my(),
    queryFn: () => api.get<Submission[]>("/submissions/my"),
  });
}

// Get my submission for a specific stage
export function useMySubmissionForStage(stageId: string) {
  return useQuery({
    queryKey: submissionKeys.myStage(stageId),
    queryFn: () => api.get<Submission | null>(`/submissions/my/stage/${stageId}`),
    enabled: !!stageId,
  });
}

// Get single submission
export function useSubmission(id: string) {
  return useQuery({
    queryKey: submissionKeys.detail(id),
    queryFn: () => api.get<Submission>(`/submissions/${id}`),
    enabled: !!id,
  });
}

// Save draft
export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveDraftInput) => api.post<Submission>("/submissions/draft", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: submissionKeys.my() });
      queryClient.setQueryData(submissionKeys.myStage(data.stageId), data);
      toast.success("Draft saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save draft");
    },
  });
}

// Submit (finalize)
export function useSubmitSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitInput) => api.post<Submission>("/submissions/submit", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: submissionKeys.my() });
      queryClient.setQueryData(submissionKeys.myStage(data.stageId), data);
      toast.success("Submission submitted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit");
    },
  });
}

// Get submission history
export function useSubmissionHistory(submissionId: string) {
  return useQuery({
    queryKey: submissionKeys.history(submissionId),
    queryFn: () => api.get<any[]>(`/submissions/${submissionId}/history`),
    enabled: !!submissionId,
  });
}

// Upload submission video
export function useUploadSubmissionVideo() {
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      return api.post<{ url: string; thumbnailUrl?: string }>("/submissions/upload-video", formData);
    },
    onSuccess: () => {
      toast.success("Video uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload video");
    },
  });
}


// ============ Admin Submission Hooks ============

export interface AdminSubmission extends Submission {
  status: "draft" | "submitted" | "late" | "pending_approval" | "approved" | "rejected" | "evaluated";
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface PaginatedSubmissions {
  submissions: AdminSubmission[];
  total: number;
  page: number;
  limit: number;
}

export interface SubmissionQueryParams {
  stageId?: string;
  cohortId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// Admin query keys
export const adminSubmissionKeys = {
  all: ["admin", "submissions"] as const,
  list: (params?: SubmissionQueryParams) => [...adminSubmissionKeys.all, "list", params] as const,
  pendingApproval: (params?: SubmissionQueryParams) => [...adminSubmissionKeys.all, "pending", params] as const,
  detail: (id: string) => [...adminSubmissionKeys.all, "detail", id] as const,
};

// Get submissions pending approval
export function usePendingApprovalSubmissions(params?: SubmissionQueryParams) {
  return useQuery({
    queryKey: adminSubmissionKeys.pendingApproval(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.stageId) searchParams.set("stageId", params.stageId);
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      // Only include status if it's a non-empty string (empty = "All")
      if (params?.status && params.status.trim() !== "") {
        searchParams.set("status", params.status);
      }
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return api.get<PaginatedSubmissions>(`/admin/submissions/pending-approval${query ? `?${query}` : ""}`);
    },
  });
}

// Get admin submission detail
export function useAdminSubmission(id: string) {
  return useQuery({
    queryKey: adminSubmissionKeys.detail(id),
    queryFn: () => api.get<AdminSubmission>(`/admin/submissions/${id}`),
    enabled: !!id,
  });
}

// Approve submission
export function useApproveSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalNotes }: { id: string; approvalNotes?: string }) =>
      api.post<AdminSubmission>(`/admin/submissions/${id}/approve`, { approvalNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSubmissionKeys.all });
      toast.success("Submission approved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve submission");
    },
  });
}

// Reject submission
export function useRejectSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.post<AdminSubmission>(`/admin/submissions/${id}/reject`, { rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSubmissionKeys.all });
      toast.success("Submission rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject submission");
    },
  });
}
