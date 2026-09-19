"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

// ============ Types ============

export interface AIScoreResult {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  explanation: string;
  confidence: number;
}

export interface HumanScoreResult {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface EvaluationMetrics {
  codeQuality?: {
    score: number;
    issues: string[];
    strengths: string[];
  };
  commitHistory?: {
    totalCommits: number;
    contributors: number;
    commitFrequency: string;
    score: number;
  };
  documentation?: {
    hasReadme: boolean;
    readmeQuality: number;
    codeComments: number;
  };
  tokensUsed?: number;
  estimatedCost?: number;
}

export interface Evaluation {
  id: string;
  teamId: string;
  stageId: string;
  cohortId: string;
  aiScores?: AIScoreResult[];
  aiOverallScore?: number;
  aiFeedback?: string;
  aiStrengths?: string[];
  aiImprovements?: string[];
  humanScores?: HumanScoreResult[];
  humanOverallScore?: number;
  humanFeedback?: string;
  finalScore?: number;
  aiWeight: number;
  metrics?: EvaluationMetrics;
  aiEvaluatedAt?: string;
  humanEvaluatedAt?: string;
  humanEvaluatorId?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  team?: {
    id: string;
    name: string;
    projectName?: string;
  };
  stage?: {
    id: string;
    name: string;
    number: number;
  };
}

export type EvaluationJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface EvaluationJob {
  id: string;
  teamId: string;
  stageId: string;
  cohortId: string;
  status: EvaluationJobStatus;
  progress: number;
  currentStep?: string;
  attempts: number;
  maxAttempts: number;
  error?: string;
  bullJobId?: string;
  startedAt?: string;
  completedAt?: string;
  processingTimeMs?: number;
  createdAt: string;
  team?: {
    id: string;
    name: string;
  };
  stage?: {
    id: string;
    name: string;
    number: number;
  };
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface EvaluationStats {
  totalTeams: number;
  evaluated: number;
  pending: number;
  failed: number;
  averageScore: number;
  averageProcessingTime: number;
}

// ============ Query Keys ============

export const evaluationKeys = {
  all: ["evaluations"] as const,
  lists: () => [...evaluationKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) => [...evaluationKeys.lists(), params] as const,
  details: () => [...evaluationKeys.all, "detail"] as const,
  detail: (id: string) => [...evaluationKeys.details(), id] as const,
  jobs: () => [...evaluationKeys.all, "jobs"] as const,
  jobList: (params?: Record<string, unknown>) => [...evaluationKeys.jobs(), params] as const,
  queueStatus: () => [...evaluationKeys.all, "queue-status"] as const,
  stats: (cohortId: string, stageId: string) => [...evaluationKeys.all, "stats", cohortId, stageId] as const,
  my: (stageId: string) => [...evaluationKeys.all, "my", stageId] as const,
};

// ============ Admin Hooks ============

export function useEvaluations(params?: {
  cohortId?: string;
  stageId?: string;
  needsHumanReview?: boolean;
  isPublished?: boolean;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: evaluationKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.stageId) searchParams.set("stageId", params.stageId);
      if (params?.needsHumanReview !== undefined) searchParams.set("needsHumanReview", String(params.needsHumanReview));
      if (params?.isPublished !== undefined) searchParams.set("isPublished", String(params.isPublished));
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return api.get<{ data: Evaluation[]; total: number; page: number; limit: number }>(
        `/admin/evaluations${query ? `?${query}` : ""}`
      );
    },
  });
}

export function useEvaluation(id: string | null) {
  return useQuery({
    queryKey: evaluationKeys.detail(id || ""),
    queryFn: async () => {
      return api.get<Evaluation>(`/admin/evaluations/${id}`);
    },
    enabled: !!id,
  });
}

export function useEvaluationJobs(params?: {
  cohortId?: string;
  stageId?: string;
  status?: EvaluationJobStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: evaluationKeys.jobList(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.stageId) searchParams.set("stageId", params.stageId);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return api.get<{ data: EvaluationJob[]; total: number; page: number; limit: number }>(
        `/admin/evaluations/jobs${query ? `?${query}` : ""}`
      );
    },
    refetchInterval: 2000, // Refresh every 2 seconds for live updates
  });
}

export function useQueueStatus() {
  return useQuery({
    queryKey: evaluationKeys.queueStatus(),
    queryFn: async () => {
      return api.get<QueueStatus>("/admin/evaluations/queue/status");
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function useEvaluationStats(cohortId: string | null, stageId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.stats(cohortId || "", stageId || ""),
    queryFn: async () => {
      return api.get<EvaluationStats>(`/admin/evaluations/stats/${cohortId}/${stageId}`);
    },
    enabled: !!cohortId && !!stageId,
  });
}

// ============ Mutation Hooks ============

export function useTriggerBatchEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { cohortId: string; stageId: string; teamIds?: string[] }) => {
      return api.post("/admin/evaluations/trigger", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: evaluationKeys.queueStatus() });
      toast.success("Batch evaluation triggered");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to trigger evaluation");
    },
  });
}

export function useTriggerSingleEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { teamId: string; stageId: string }) => {
      return api.post("/admin/evaluations/trigger/single", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: evaluationKeys.queueStatus() });
      toast.success("Evaluation triggered");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to trigger evaluation");
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      return api.post(`/admin/evaluations/jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.jobs() });
      toast.success("Job retry triggered");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to retry job");
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      return api.post(`/admin/evaluations/jobs/${jobId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.jobs() });
      toast.success("Job cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel job");
    },
  });
}

export function usePauseQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.post("/admin/evaluations/queue/pause");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.queueStatus() });
      toast.success("Queue paused");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to pause queue");
    },
  });
}

export function useResumeQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.post("/admin/evaluations/queue/resume");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.queueStatus() });
      toast.success("Queue resumed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resume queue");
    },
  });
}

export function useSubmitHumanScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      evaluationId: string;
      scores: Array<{
        criterionId: string;
        criterionName: string;
        score: number;
        maxScore: number;
        comment?: string;
      }>;
      feedback?: string;
    }) => {
      return api.post(`/admin/evaluations/${data.evaluationId}/human-score`, {
        scores: data.scores,
        feedback: data.feedback,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.detail(variables.evaluationId) });
      queryClient.invalidateQueries({ queryKey: evaluationKeys.lists() });
      toast.success("Human score submitted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit score");
    },
  });
}

export function useUpdateAIWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { evaluationId: string; aiWeight: number }) => {
      return api.patch(`/admin/evaluations/${data.evaluationId}/ai-weight`, {
        aiWeight: data.aiWeight,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.detail(variables.evaluationId) });
      toast.success("AI weight updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update AI weight");
    },
  });
}

export function usePublishEvaluations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (evaluationIds: string[]) => {
      return api.post("/admin/evaluations/publish", { evaluationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.lists() });
      toast.success("Evaluations published");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to publish evaluations");
    },
  });
}

export function useUnpublishEvaluations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (evaluationIds: string[]) => {
      return api.post("/admin/evaluations/unpublish", { evaluationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evaluationKeys.lists() });
      toast.success("Evaluations unpublished");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unpublish evaluations");
    },
  });
}

// ============ Participant Hook ============

export function useMyEvaluation(stageId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.my(stageId || ""),
    queryFn: async () => {
      return api.get<Evaluation | null>(`/evaluations/my/${stageId}`);
    },
    enabled: !!stageId,
  });
}
