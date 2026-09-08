"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

// ============ Types ============

export interface PeerReviewRubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  levels?: Array<{
    score: number;
    label: string;
    description: string;
  }>;
}

export interface PeerReviewRubric {
  id: string;
  cohortId: string;
  stageId?: string;
  name: string;
  description?: string;
  criteria: PeerReviewRubricCriterion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PeerReviewAssignmentStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface PeerReviewAssignment {
  id: string;
  cohortId: string;
  stageId: string;
  reviewerTeamId: string;
  reviewedTeamId: string;
  status: PeerReviewAssignmentStatus;
  dueDate: string;
  assignedAt: string;
  completedAt?: string;
  reviewedTeam?: {
    id: string;
    name: string;
    projectName?: string;
  };
  reviewerTeam?: {
    id: string;
    name: string;
  };
  stage?: {
    id: string;
    name: string;
    number: number;
  };
}

export interface PeerReviewScore {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface PeerReview {
  id: string;
  assignmentId: string;
  reviewerParticipantId: string;
  scores: PeerReviewScore[];
  overallScore: number;
  overallComment?: string;
  strengths?: string[];
  improvements?: string[];
  isAnonymous: boolean;
  submittedAt: string;
  timeSpentMinutes?: number;
  isFlagged: boolean;
  flagReason?: string;
  assignment?: PeerReviewAssignment;
}

export interface PeerReviewStageStats {
  totalAssignments: number;
  completed: number;
  pending: number;
  inProgress: number;
  skipped: number;
  overdue: number;
  averageScore: number;
}

export interface TeamReviewSummary {
  reviewsGiven: number;
  reviewsReceived: number;
  averageScoreGiven: number;
  averageScoreReceived: number;
}

// ============ Query Keys ============

export const peerReviewKeys = {
  all: ["peer-reviews"] as const,
  myAssigned: () => [...peerReviewKeys.all, "my-assigned"] as const,
  myReceived: () => [...peerReviewKeys.all, "my-received"] as const,
  assignment: (id: string) => [...peerReviewKeys.all, "assignment", id] as const,
  rubric: (cohortId: string, stageId: string) => [...peerReviewKeys.all, "rubric", cohortId, stageId] as const,
  adminRubrics: (cohortId: string) => [...peerReviewKeys.all, "admin-rubrics", cohortId] as const,
  adminRubric: (id: string) => [...peerReviewKeys.all, "admin-rubric", id] as const,
  adminAssignments: (params?: Record<string, unknown>) => [...peerReviewKeys.all, "admin-assignments", params] as const,
  adminReviews: (params?: Record<string, unknown>) => [...peerReviewKeys.all, "admin-reviews", params] as const,
  adminReview: (id: string) => [...peerReviewKeys.all, "admin-review", id] as const,
  stageStats: (cohortId: string, stageId: string) => [...peerReviewKeys.all, "stage-stats", cohortId, stageId] as const,
  teamSummary: (teamId: string) => [...peerReviewKeys.all, "team-summary", teamId] as const,
};

// ============ Participant Hooks ============

export function useMyAssignedReviews() {
  return useQuery({
    queryKey: peerReviewKeys.myAssigned(),
    queryFn: () => api.get<PeerReviewAssignment[]>("/peer-reviews/my/assigned"),
  });
}

export function useMyReceivedReviews() {
  return useQuery({
    queryKey: peerReviewKeys.myReceived(),
    queryFn: () => api.get<PeerReview[]>("/peer-reviews/my/received"),
  });
}

export function usePeerReviewAssignment(id: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.assignment(id || ""),
    queryFn: () => api.get<PeerReviewAssignment>(`/peer-reviews/assignments/${id}`),
    enabled: !!id,
  });
}

export function useRubricForStage(cohortId: string | null, stageId: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.rubric(cohortId || "", stageId || ""),
    queryFn: () => api.get<PeerReviewRubric>(`/peer-reviews/rubric/${cohortId}/${stageId}`),
    enabled: !!cohortId && !!stageId,
  });
}

export function useSubmitPeerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      assignmentId: string;
      scores: PeerReviewScore[];
      overallComment?: string;
      strengths?: string[];
      improvements?: string[];
      isAnonymous?: boolean;
      timeSpentMinutes?: number;
    }) => api.post<PeerReview>("/peer-reviews", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.myAssigned() });
      toast.success("Peer review submitted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit peer review");
    },
  });
}

// ============ Admin Hooks ============

export function useAdminRubrics(cohortId: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.adminRubrics(cohortId || ""),
    queryFn: () => api.get<PeerReviewRubric[]>(`/admin/peer-reviews/rubrics/cohort/${cohortId}`),
    enabled: !!cohortId,
  });
}

export function useAdminRubric(id: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.adminRubric(id || ""),
    queryFn: () => api.get<PeerReviewRubric>(`/admin/peer-reviews/rubrics/${id}`),
    enabled: !!id,
  });
}

export function useCreateRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      cohortId: string;
      stageId?: string;
      name: string;
      description?: string;
      criteria: PeerReviewRubricCriterion[];
    }) => api.post<PeerReviewRubric>("/admin/peer-reviews/rubrics", data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.adminRubrics(variables.cohortId) });
      toast.success("Rubric created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create rubric");
    },
  });
}

export function useUpdateRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; criteria?: PeerReviewRubricCriterion[]; isActive?: boolean } }) =>
      api.patch<PeerReviewRubric>(`/admin/peer-reviews/rubrics/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.adminRubrics(data.cohortId) });
      queryClient.setQueryData(peerReviewKeys.adminRubric(data.id), data);
      toast.success("Rubric updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update rubric");
    },
  });
}

export function useDeleteRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/peer-reviews/rubrics/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.all });
      toast.success("Rubric deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete rubric");
    },
  });
}

export function useAssignPeerReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { cohortId: string; stageId: string; reviewsPerTeam: number; dueDate: string }) =>
      api.post("/admin/peer-reviews/assign", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.all });
      toast.success("Peer reviews assigned");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign peer reviews");
    },
  });
}

export function useAdminAssignments(params?: {
  cohortId?: string;
  stageId?: string;
  status?: PeerReviewAssignmentStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: peerReviewKeys.adminAssignments(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.stageId) searchParams.set("stageId", params.stageId);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return api.get<{ data: PeerReviewAssignment[]; total: number; page: number; limit: number }>(
        `/admin/peer-reviews/assignments${query ? `?${query}` : ""}`
      );
    },
  });
}

export function useAdminReviews(params?: { cohortId?: string; stageId?: string }) {
  return useQuery({
    queryKey: peerReviewKeys.adminReviews(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.stageId) searchParams.set("stageId", params.stageId);
      const query = searchParams.toString();
      return api.get<PeerReview[]>(`/admin/peer-reviews/reviews${query ? `?${query}` : ""}`);
    },
  });
}

export function useAdminReview(id: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.adminReview(id || ""),
    queryFn: () => api.get<PeerReview>(`/admin/peer-reviews/reviews/${id}`),
    enabled: !!id,
  });
}

export function useFlagReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/peer-reviews/reviews/${id}/flag`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.all });
      toast.success("Review flagged");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to flag review");
    },
  });
}

export function useUnflagReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/peer-reviews/reviews/${id}/unflag`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.all });
      toast.success("Review unflagged");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unflag review");
    },
  });
}

export function useSkipAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/peer-reviews/assignments/${id}/skip`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.all });
      toast.success("Assignment skipped");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to skip assignment");
    },
  });
}

export function useDeleteStageAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cohortId, stageId }: { cohortId: string; stageId: string }) =>
      api.delete(`/admin/peer-reviews/assignments/stage/${cohortId}/${stageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peerReviewKeys.all });
      toast.success("Stage assignments deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete assignments");
    },
  });
}

export function usePeerReviewStageStats(cohortId: string | null, stageId: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.stageStats(cohortId || "", stageId || ""),
    queryFn: () => api.get<PeerReviewStageStats>(`/admin/peer-reviews/stats/stage/${cohortId}/${stageId}`),
    enabled: !!cohortId && !!stageId,
  });
}

export function useTeamReviewSummary(teamId: string | null) {
  return useQuery({
    queryKey: peerReviewKeys.teamSummary(teamId || ""),
    queryFn: () => api.get<TeamReviewSummary>(`/admin/peer-reviews/stats/team/${teamId}`),
    enabled: !!teamId,
  });
}
