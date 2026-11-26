"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export interface BuilderFilters {
  cohortId?: string; search?: string; group?: string; ungrouped?: boolean; country?: string;
  confirmation: "all" | "confirmed" | "pending"; assignment: "all" | "assigned" | "unassigned";
}
export interface Builder {
  id: string; participantId: string; firstName: string; lastName: string; email: string; country: string;
  cohortId: string; cohortName: string; group: string | null; teamId: string | null; teamName: string | null;
  builderConfirm: boolean; preferredLanguage: string | null; otherLanguage: string | null; languageProficiency: string | null;
  developmentExperience: boolean | null; testingExperience: boolean | null; deploymentExperience: boolean | null;
}
export interface BuildersResult {
  data: Builder[]; total: number; page: number; limit: number; totalPages: number;
  summary: { total: number; confirmed: number; pending: number; assigned: number; unassigned: number };
}
export interface BuilderBroadcast {
  id: string; state: "queued" | "active" | "completed" | "failed"; subject: string;
  total: number; processed: number; sent: number; failed: number; skipped: number;
  failures: { participantId: string; message: string }[];
}
export function builderQuery(filters: BuilderFilters & { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
export function useBuilders(filters: BuilderFilters, page: number, limit: number) {
  return useQuery({ queryKey: ["builders", filters, page, limit], queryFn: () => api.get<BuildersResult>(`/participants/builders?${builderQuery({ ...filters, page, limit })}`) });
}
export function useBuilderBroadcast(id: string | null) {
  return useQuery({ queryKey: ["builder-broadcast", id], queryFn: () => api.get<BuilderBroadcast>(`/participants/builders/broadcasts/${id}`), enabled: !!id,
    refetchInterval: query => ["queued", "active"].includes(query.state.data?.state || "queued") ? 2000 : false, retry: false });
}
