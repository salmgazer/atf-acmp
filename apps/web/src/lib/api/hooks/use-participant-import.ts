"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ParticipantImportField } from "@acmp/shared";
import { api } from "@/lib/api/client";

export interface ParticipantImportInput {
  cohortId: string; csv: string; sourceName: string; group?: string;
  mode: "create_and_update" | "create_only" | "update_only";
  updateFields: ParticipantImportField[]; allowLearningCorrections: boolean; sendWelcomeEmail: boolean;
}
export interface ParticipantImportRow {
  row: number; participantId: string; email?: string; name: string; existingId?: string;
  outcome: "new" | "updated" | "unchanged" | "excluded" | "conflict";
  reason?: string; warnings: string[]; changes: { field: string; before: string | boolean | null; after: string | boolean | null }[];
  data: Record<string, string | boolean | null>;
}
export type ParticipantImportCounts = Record<ParticipantImportRow["outcome"], number>;
export interface ParticipantImportPreview {
  ready: boolean; previewHash: string; total: number; counts: ParticipantImportCounts; records: ParticipantImportRow[]; errors: string[]; warnings: string[];
}
export interface ParticipantImportBatch {
  id: string; state: "queued" | "active" | "completed" | "failed"; sourceName: string; cohortId: string; createdAt: string; error?: string;
  result: { stage?: string; total?: number; prepared?: number; totalNew?: number; counts?: ParticipantImportCounts; records?: ParticipantImportRow[]; affectedTeamIds?: string[]; inviteBatches?: string[]; invitationState?: string; invitationWarning?: string };
}
export function usePreviewParticipantImport() {
  return useMutation({ mutationFn: (input: ParticipantImportInput) => api.post<ParticipantImportPreview>("/participants/import/preview", input, { timeout: 120000 }), onError: (error: Error) => toast.error(error.message || "Could not preview participants") });
}
export function useApplyParticipantImport() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: ParticipantImportInput & { previewHash: string }) => api.post<ParticipantImportBatch>("/participants/import/apply", input, { timeout: 120000 }),
    onSuccess: batch => { cache.setQueryData(["participant-import", batch.id], batch); toast.success("Participant import queued"); },
    onError: (error: Error) => toast.error(error.message || "Could not queue the import. Refresh the preview."),
  });
}
export function useParticipantImportBatch(id: string | null) {
  return useQuery({ queryKey: ["participant-import", id], enabled: !!id, queryFn: () => api.get<ParticipantImportBatch>(`/participants/import/batches/${id}`),
    refetchInterval: query => { const batch = query.state.data; return !batch || ["queued", "active"].includes(batch.state) || batch.result.invitationState === "pending" ? 2000 : false; }, retry: 1 });
}
