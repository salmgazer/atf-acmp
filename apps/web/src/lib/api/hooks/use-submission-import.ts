"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

export interface SubmissionImportInput {
  cohortId: string; csv: string; sourceName: string; sourceTimezone: string; primaryContacts?: Record<string, string>;
}
export interface SubmissionImportPreview {
  ready: boolean; previewHash: string; sourceName: string; cohortId: string; sourceTimezone: string;
  totalBriefs: number; newPartners: number; newUsers: number; newBriefs: number; skippedBriefs: number;
  organizations: { key: string; name: string; country: string; organizationId?: string; primaryEmail: string; primaryCandidates: { email: string; name: string }[]; rows: number[]; newBriefs: number; skippedBriefs: number }[];
  briefs: { row: number; title: string; partner: string; submittedAt: string; status: "new" | "skipped"; submitter: { name: string; email: string }; host: { name: string; email: string; source: "brief" | "partner" }; fitScore: number; impactScore: number | null }[];
  errors: { row?: number; message: string }[]; warnings: { row?: number; message: string }[];
}
export interface SubmissionImportReceipt { batchId: string; createdPartners: number; createdUsers: number; createdBriefs: number; skippedBriefs: number; briefIds: string[] }

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
      toast.success(`${receipt.createdBriefs} briefs imported`);
    },
    onError: (error: Error) => toast.error(error.message || "Import failed. Refresh the preview before retrying."),
  });
}
