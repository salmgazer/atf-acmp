"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { FormAnswers, TEAM_WORKFLOW_STEPS, TeamWorkflowStep } from "@acmp/shared";
import { FileUrl } from "./use-submissions";
export interface TeamWorkflowProgress {
  team: null | { id: string; name: string; briefId?: string; briefTitle?: string; briefPreference: string; githubRepoUrl?: string; registered?: boolean };
  canEdit: boolean; canSubmitOwnBrief: boolean; learningComplete?: boolean; inactiveFor14Days?: boolean;
  ownBrief?: { id: string; title: string; status: string; reviewFeedback?: string } | null;
  warmup?: { id: string; status: string; jobStatus?: string; rejectionReason?: string; result?: { passed: boolean; summary: string } } | null;
  proposal?: { id: string; status: string; rejectionReason?: string; approvalNotes?: string; evaluationNotes?: string } | null;
  steps: Array<{ key: TeamWorkflowStep; number: number; name: string; stageId?: string; completed: boolean; status: string; deadline?: string; startDate?: string | null }>;
}
export interface OwnTeamBrief { id: string; status: string; reviewFeedback?: string; answers: FormAnswers; fileUrls: FileUrl[] }
export const workflowKey = ["team-workflow"] as const;
export function useTeamWorkflow() { return useQuery({ refetchInterval: query => ["pending", "processing"].includes(query.state.data?.warmup?.jobStatus || "") ? 5000 : false, queryKey: workflowKey, queryFn: async () => {
  const progress = await api.get<TeamWorkflowProgress>("/team-workflow?version=2");
  if (!progress || !Array.isArray(progress.steps) || ![TEAM_WORKFLOW_STEPS.length, TEAM_WORKFLOW_STEPS.length - 1].includes(progress.steps.length)) throw new Error("Could not load the six programme steps. Please retry.");
  return progress;
} }); }
export function useOwnTeamBrief(enabled = true) { return useQuery({ enabled, queryKey: [...workflowKey, "brief"], queryFn: () => api.get<OwnTeamBrief | null>("/team-workflow/brief") }); }
