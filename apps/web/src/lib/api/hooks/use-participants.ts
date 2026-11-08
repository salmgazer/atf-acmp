"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ParticipantLearningProfile, ParticipantMatchingProfile, BuildDeployAbility, MatchingRole, MatchingSector, MatchingTeamStatus } from "@acmp/shared";

// Types
export type ParticipantStatus =
  | "imported"
  | "active"
  | "onboarding"
  | "ready"
  | "assigned"
  | "inactive";

export interface Participant extends ParticipantLearningProfile {
  id: string;
  participantId: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  institution?: string;
  phoneNumber?: string;
  skills: string[];
  interests: string[];
  firebaseUid?: string;
  mustChangePassword: boolean;
  onboardingComplete: boolean;
  profileImageUrl?: string;
  status: ParticipantStatus;
  cohortId: string;
  group?: string | null;
  cohort?: { countries: string[] };
  createdAt: string;
  updatedAt: string;
  preference?: ParticipantPreference;
}

export interface ParticipantPreference extends ParticipantMatchingProfile {
  id: string;
  participantId: string;
  verticalId1?: string;
  verticalId2?: string;
  briefRankings: string[];
  crossCountryWilling: boolean;
  availabilityNotes?: string;
  preferencesUpdatedAt?: string;
}

export interface ParticipantQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  cohortId?: string;
  group?: string;
  ungrouped?: boolean;
  country?: string;
  status?: ParticipantStatus;
  onboardingComplete?: boolean;
}

export interface PaginatedParticipants {
  data: Participant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ParticipantStatistics {
  total: number;
  imported: number;
  active: number;
  onboarding: number;
  ready: number;
  assigned: number;
  inactive: number;
  onboardingCompleted: number;
  passwordChanged: number;
  byCountry: Record<string, number>;
}

export interface BulkImportRow {
  participantId: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  institution?: string;
  phoneNumber?: string;
}

export interface BulkImportDto {
  cohortId: string;
  group?: string;
  participants: BulkImportRow[];
  sendWelcomeEmail?: boolean;
}

export interface ImportResult {
  success: boolean;
  participantId: string;
  email: string;
  error?: string;
}

export interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: ImportResult[];
}

export interface OnboardingProfile {
  firstName: string; lastName: string; country: string; institution?: string; phoneNumber?: string;
  whatsappNumber?: string; city?: string; locationType?: string; gender?: string; educationLevel?: string;
  currentAffiliation?: string; fieldOfStudy?: string; pythonSkill?: string; gitSkill?: string; aiExperience?: string;
  githubAccountStatus: "has_account" | "no_account"; githubUsername?: string;
}

export interface OnboardingSkills {
  skills: string[];
  interests: string[];
}

export interface OnboardingPreferences {
  verticalId1?: string;
  verticalId2?: string;
  briefRankings: string[];
  crossCountryWilling: boolean;
  preferredRole?: string;
  availabilityNotes?: string;
}

export interface CompleteOnboardingDto {
  profile: OnboardingProfile;
  skills: OnboardingSkills;
  preferences: OnboardingPreferences & {
    buildDeployAbility: BuildDeployAbility; preferredRole: MatchingRole; firstChoiceSector: MatchingSector;
    backupSector: MatchingSector; teamStatus: MatchingTeamStatus; matchingProfileConsent: boolean;
  };
}

export interface UpdateParticipantDto {
  firstName?: string;
  lastName?: string;
  institution?: string;
  phoneNumber?: string;
  skills?: string[];
  interests?: string[];
}

export function canResendParticipantInvite(participant: Participant): boolean {
  return participant.mustChangePassword && !participant.onboardingComplete && participant.status !== "inactive";
}

export interface ParticipantInviteBatch {
  id: string;
  state: "queued" | "active" | "completed" | "failed";
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  failures: { participantId: string; message: string }[];
  error?: string;
}

export type ParticipantInviteRequest = { mode: "single"; participantId: string }
  | { mode: "selected"; participantIds: string[] }
  | { mode: "pending"; filters: { cohortId: string; group?: string; ungrouped?: boolean; search?: string; status?: ParticipantStatus } };

export function useResendParticipantInvites() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (request: ParticipantInviteRequest) => request.mode === "single"
      ? api.post<ParticipantInviteBatch>(`/participants/${request.participantId}/resend-invite`)
      : request.mode === "selected" ? api.post<ParticipantInviteBatch>("/participants/resend-invites", { participantIds: request.participantIds })
        : api.post<ParticipantInviteBatch>("/participants/resend-pending-invites", request.filters),
    onSuccess: batch => {
      cache.setQueryData(["participant-invite-batch", batch.id], batch);
      toast.success(`${batch.total} invitation${batch.total === 1 ? "" : "s"} queued`);
    },
    onError: (error: Error) => toast.error(error.message || "Could not resend invitations"),
  });
}

export function useParticipantInviteBatch(id: string | null) {
  return useQuery({
    queryKey: ["participant-invite-batch", id],
    queryFn: () => api.get<ParticipantInviteBatch>(`/participants/invite-resends/${id}`),
    enabled: !!id,
    refetchInterval: query => ["queued", "active"].includes(query.state.data?.state || "queued") ? 1500 : false,
    retry: false,
  });
}

// Query keys
export const participantKeys = {
  all: ["participants"] as const,
  lists: () => [...participantKeys.all, "list"] as const,
  list: (params?: ParticipantQueryParams) => [...participantKeys.lists(), params] as const,
  details: () => [...participantKeys.all, "detail"] as const,
  detail: (id: string) => [...participantKeys.details(), id] as const,
  statistics: (cohortId?: string) => [...participantKeys.all, "statistics", cohortId] as const,
  preferences: (id: string) => [...participantKeys.all, "preferences", id] as const,
  ready: (cohortId: string) => [...participantKeys.all, "ready", cohortId] as const,
  byCountry: (cohortId: string, country: string) =>
    [...participantKeys.all, "country", cohortId, country] as const,
  current: () => [...participantKeys.all, "current"] as const,
};

// Hooks

export function useParticipants(params?: ParticipantQueryParams) {
  return useQuery({
    queryKey: participantKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.search) searchParams.set("search", params.search);
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.group) searchParams.set("group", params.group);
      if (params?.ungrouped) searchParams.set("ungrouped", "true");
      if (params?.country) searchParams.set("country", params.country);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.onboardingComplete !== undefined) {
        searchParams.set("onboardingComplete", String(params.onboardingComplete));
      }

      return api.get<PaginatedParticipants>(`/participants?${searchParams.toString()}`);
    },
  });
}

export function useAssignParticipantGroup() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ id, group }: { id: string; group: string | null }) => api.patch<Participant>(`/participants/${id}/group`, { group }),
    onSuccess: () => { cache.invalidateQueries({ queryKey: participantKeys.all }); toast.success("Participant group updated"); },
    onError: (error: Error) => toast.error(error.message || "Could not assign group"),
  });
}

export function useParticipant(id: string) {
  return useQuery({
    queryKey: participantKeys.detail(id),
    queryFn: () => api.get<Participant>(`/participants/${id}`),
    enabled: !!id,
  });
}

export function useCurrentParticipant() {
  return useQuery({
    queryKey: participantKeys.current(),
    queryFn: () => api.get<Participant>("/participants/me"),
  });
}

export function useParticipantStatistics(cohortId?: string) {
  return useQuery({
    queryKey: participantKeys.statistics(cohortId),
    queryFn: async () => {
      const url = cohortId
        ? `/participants/statistics?cohortId=${cohortId}`
        : "/participants/statistics";
      return api.get<ParticipantStatistics>(url);
    },
  });
}

export function useParticipantPreferences(participantId: string) {
  return useQuery({
    queryKey: participantKeys.preferences(participantId),
    queryFn: () => api.get<ParticipantPreference>(`/participants/${participantId}/preferences`),
    enabled: !!participantId,
  });
}

export function useReadyParticipants(cohortId: string) {
  return useQuery({
    queryKey: participantKeys.ready(cohortId),
    queryFn: () => api.get<Participant[]>(`/participants/cohort/${cohortId}/ready`),
    enabled: !!cohortId,
  });
}

export function useParticipantsByCountry(cohortId: string, country: string) {
  return useQuery({
    queryKey: participantKeys.byCountry(cohortId, country),
    queryFn: () => api.get<Participant[]>(`/participants/cohort/${cohortId}/country/${country}`),
    enabled: !!cohortId && !!country,
  });
}

// Mutations

export function useUpdateParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateParticipantDto }) =>
      api.patch<Participant>(`/participants/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.lists() });
      queryClient.setQueryData(participantKeys.detail(data.id), data);
      toast.success("Participant updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update participant");
    },
  });
}

export function useUpdateParticipantStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ParticipantStatus }) =>
      api.patch<Participant>(`/participants/${id}/status`, { status }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.lists() });
      queryClient.setQueryData(participantKeys.detail(data.id), data);
      toast.success("Status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status");
    },
  });
}

export function useBulkImportParticipants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkImportDto) => api.post<BulkImportResult>("/participants/bulk-import", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
      if (data.failureCount === 0) {
        toast.success(`Successfully imported ${data.successCount} participants`);
      } else {
        toast.warning(
          `Imported ${data.successCount} of ${data.totalProcessed} participants. ${data.failureCount} failed.`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import participants");
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteOnboardingDto }) =>
      api.post<Participant>(`/participants/${id}/onboarding`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
      queryClient.setQueryData(participantKeys.detail(data.id), data);
      toast.success("Onboarding completed successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to complete onboarding");
    },
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ participantId, data }: { participantId: string; data: OnboardingPreferences }) =>
      api.put<ParticipantPreference>(`/participants/${participantId}/preferences`, data),
    onSuccess: (data, { participantId }) => {
      queryClient.setQueryData(participantKeys.preferences(participantId), data);
      toast.success("Preferences saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save preferences");
    },
  });
}

export function useUpdateBriefRankings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ participantId, briefRankings }: { participantId: string; briefRankings: string[] }) =>
      api.put<ParticipantPreference>(`/participants/${participantId}/brief-rankings`, { briefRankings }),
    onSuccess: (data, { participantId }) => {
      queryClient.setQueryData(participantKeys.preferences(participantId), data);
      toast.success("Rankings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save rankings");
    },
  });
}

export function useDeleteParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/participants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
      toast.success("Participant deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete participant");
    },
  });
}

export function useUploadMyProfilePicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/participants/me/profile-picture`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "Failed to upload profile picture");
      }

      return response.json() as Promise<Participant>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: participantKeys.current() });
    },
  });
}

export function useUpdateMatchingConsent() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: ({ id, consent }: { id: string; consent: boolean }) => api.patch<ParticipantPreference>(`/participants/${id}/matching-consent`, { consent }),
    onSuccess: (preference, { id }) => { cache.setQueryData(participantKeys.preferences(id), preference); cache.invalidateQueries({ queryKey: participantKeys.all }); toast.success("Matching profile visibility updated"); },
    onError: (error: Error) => toast.error(error.message || "Could not update consent") });
}

export function useUpdateParticipantProgramme() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: { id: string; programmeOptedOut: boolean; codeLabsCompleted: boolean; reason?: string }) => api.patch<Participant>(`/participants/${id}/programme-status`, body),
    onSuccess: () => { cache.invalidateQueries({ queryKey: participantKeys.all }); cache.invalidateQueries({ queryKey: ["teams"] }); toast.success("Programme status updated"); }, onError: (error: Error) => toast.error(error.message || "Could not update programme status") });
}
