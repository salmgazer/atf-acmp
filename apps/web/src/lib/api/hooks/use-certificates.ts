"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// ============ Types ============

export type CertificateTier = "participation" | "completion" | "excellence" | "winner";
export type CertificateStatus = "pending" | "generated" | "failed";

export interface Certificate {
  id: string;
  certificateId: string;
  tier: CertificateTier;
  status: CertificateStatus;
  participantName: string;
  teamName?: string;
  cohortName: string;
  verticalName?: string;
  finalScore?: number;
  rank?: number;
  pdfUrl?: string;
  verificationUrl?: string;
  generatedAt?: string;
  downloadCount: number;
}

export interface CertificateQueryParams {
  cohortId?: string;
  tier?: CertificateTier;
  limit?: number;
  offset?: number;
}

export interface GenerateCertificatesDto {
  cohortId: string;
  participantIds?: string[];
  overrideTier?: CertificateTier;
}

export interface GenerationResult {
  total: number;
  generated: number;
  failed: number;
  skipped: number;
  errors: Array<{ participantId: string; error: string }>;
}

export interface CertificateStats {
  total: number;
  byTier: Record<CertificateTier, number>;
  byStatus: Record<CertificateStatus, number>;
}

export interface VerificationResponse {
  valid: boolean;
  certificate?: {
    certificateId: string;
    participantName: string;
    teamName?: string;
    cohortName: string;
    tier: CertificateTier;
    generatedAt?: string;
    rank?: number;
  };
}

// ============ Query Keys ============

export const certificateKeys = {
  all: ["certificates"] as const,
  my: () => [...certificateKeys.all, "my"] as const,
  admin: (params: CertificateQueryParams) => [...certificateKeys.all, "admin", params] as const,
  stats: (cohortId: string) => [...certificateKeys.all, "stats", cohortId] as const,
  detail: (id: string) => [...certificateKeys.all, "detail", id] as const,
  verify: (certificateId: string) => [...certificateKeys.all, "verify", certificateId] as const,
};

// ============ Hooks ============

export function useMyCertificates() {
  return useQuery({
    queryKey: certificateKeys.my(),
    queryFn: () => api.get<Certificate[]>("/certificates/my"),
  });
}

export function useAdminCertificates(params: CertificateQueryParams) {
  return useQuery({
    queryKey: certificateKeys.admin(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params.tier) searchParams.set("tier", params.tier);
      if (params.limit) searchParams.set("limit", params.limit.toString());
      if (params.offset) searchParams.set("offset", params.offset.toString());

      return api.get<{
        data: Certificate[];
        meta: { total: number; limit: number; offset: number };
      }>(`/admin/certificates?${searchParams.toString()}`);
    },
    enabled: !!params.cohortId,
  });
}

export function useCertificateStats(cohortId: string) {
  return useQuery({
    queryKey: certificateKeys.stats(cohortId),
    queryFn: () => api.get<CertificateStats>(`/admin/certificates/stats/${cohortId}`),
    enabled: !!cohortId,
  });
}

export function useVerifyCertificate(certificateId: string) {
  return useQuery({
    queryKey: certificateKeys.verify(certificateId),
    queryFn: () => api.get<VerificationResponse>(`/certificates/verify/${certificateId}`),
    enabled: !!certificateId,
  });
}

export function useGenerateCertificates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: GenerateCertificatesDto) =>
      api.post<GenerationResult>("/admin/certificates/generate", dto),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.all });
      toast.success(
        `Generated ${result.generated} certificates. ${result.skipped} skipped, ${result.failed} failed.`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate certificates");
    },
  });
}

export function useUpdateCertificateTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: CertificateTier }) =>
      api.patch<Certificate>(`/admin/certificates/${id}/tier`, { tier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.all });
      toast.success("Certificate tier updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update tier");
    },
  });
}

export function useRegenerateCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<Certificate>(`/admin/certificates/${id}/regenerate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.all });
      toast.success("Certificate regenerated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to regenerate certificate");
    },
  });
}

export function useDeleteCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/certificates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.all });
      toast.success("Certificate deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete certificate");
    },
  });
}
