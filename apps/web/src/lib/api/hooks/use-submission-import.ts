"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { SubmissionImportMode, SubmissionUpdateField } from "@acmp/shared";

export interface SubmissionImportInput {
  cohortId: string; csv: string; sourceName: string; sourceTimezone: string; primaryContacts?: Record<string, string>;
  mode?: SubmissionImportMode; updateFields?: SubmissionUpdateField[];
}
export interface SubmissionUpdate {
  entity: "partner" | "brief"; id: string; name: string; rows: number[];
  changes: { field: SubmissionUpdateField; label: string; before: Record<string, unknown>; after: Record<string, string> }[];
}
export interface SubmissionImportPreview {
  ready: boolean; previewHash: string; sourceName: string; cohortId: string; sourceTimezone: string;
  totalBriefs: number; newPartners: number; newUsers: number; newBriefs: number; skippedBriefs: number;
  mode?: SubmissionImportMode; updateFields?: SubmissionUpdateField[]; updates?: SubmissionUpdate[];
  updatedPartners?: number; updatedBriefs?: number; unchangedBriefs?: number; unmatchedBriefs?: number;
  organizations: { key: string; name: string; country: string; organizationId?: string; primaryEmail: string; primaryCandidates: { email: string; name: string }[]; rows: number[]; newBriefs: number; skippedBriefs: number }[];
  briefs: { row: number; title: string; partner: string; industry?: string; submittedAt: string; status: "new" | "skipped" | "updated" | "unchanged" | "unmatched"; submitter: { name: string; email: string }; host: { name: string; email: string; source: "brief" | "partner" }; fitScore: number; impactScore: number | null }[];
  errors: { row?: number; message: string }[]; warnings: { row?: number; message: string }[];
}
export interface SubmissionImportReceipt { batchId: string; mode?: SubmissionImportMode; createdPartners: number; createdUsers: number; createdBriefs: number; skippedBriefs: number; briefIds: string[]; updatedPartners?: number; updatedBriefs?: number; unchangedBriefs?: number; unmatchedBriefs?: number; updateFields?: SubmissionUpdateField[]; updates?: SubmissionUpdate[] }

export function usePreviewSubmissionImport() {
  return useMutation({
    mutationFn: (input: SubmissionImportInput) => api.post<SubmissionImportPreview>("/organizations/submission-import/preview", input, { timeout: 120000 }),
    onError: (error: Error) => toast.error(error.message || "Could not preview the CSV"),
  });
}
export function useApplySubmissionImport() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmissionImportInput & { previewHash: string }) => api.post<SubmissionImportReceipt>("/organizations/submission-import/apply", input, { timeout: 120000 }),
    onSuccess: receipt => {
      cache.invalidateQueries({ queryKey: ["organizations"] });
      cache.invalidateQueries({ queryKey: ["briefs"] });
      toast.success(receipt.mode === "update_existing" ? `${receipt.updatedPartners} partners and ${receipt.updatedBriefs} briefs updated` : `${receipt.createdBriefs} briefs imported`);
    },
    onError: (error: Error) => toast.error(error.message || "Import failed. Refresh the preview before retrying."),
  });
}
