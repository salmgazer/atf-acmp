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
  status: "draft" | "submitted" | "late" | "evaluated";
  content: Record<string, any>;
  fileUrls: FileUrl[];
  githubUrl?: string;
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
  version: number;
  lastSavedAt?: string;
  createdAt: string;
  updatedAt: string;
  stage?: Stage;
  team?: {
    id: string;
    name: string;
  };
}

export interface SaveDraftInput {
  stageId: string;
  content?: Record<string, any>;
  fileUrls?: FileUrl[];
  githubUrl?: string;
  videoUrl?: string;
}

export interface SubmitInput {
  stageId: string;
  content?: Record<string, any>;
  fileUrls?: FileUrl[];
  githubUrl?: string;
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
