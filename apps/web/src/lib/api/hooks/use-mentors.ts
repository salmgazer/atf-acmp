"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiClient } from "@/lib/api/client";

// Types
export type MentorStatus = "imported" | "active" | "inactive";

export interface Mentor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise: string[];
  linkedinUrl?: string;
  maxTeams: number;
  verticalScope: string[];
  status: MentorStatus;
  cohortId: string;
  assignments?: MentorAssignment[];
  createdAt: string;
  // Session stats (from list endpoint)
  confirmedSessions?: number;
  completedSessions?: number;
  sessionRate?: number;
  totalEarned?: number;
  totalPaid?: number;
  unpaidAmount?: number;
  sessionRateOverride?: number | null;
}

export interface MentorAssignment {
  id: string;
  mentorId: string;
  teamId: string;
  team?: {
    id: string;
    name: string;
    status: string;
    brief?: {
      id: string;
      title: string;
      organization?: { name: string };
    };
    members?: Array<{
      id: string;
      participant: {
        firstName: string;
        lastName: string;
        email: string;
      };
      role: string;
    }>;
  };
  assignedAt: string;
  isActive: boolean;
}

export interface MentorSession {
  id: string;
  mentorId: string;
  teamId: string;
  team?: {
    id: string;
    name: string;
  };
  sessionDate: string;
  durationMinutes: number;
  notes?: string;
  topicsDiscussed: string[];
  actionItems: string[];
  teamProgressNotes?: string;
  nextSessionGoals?: string;
  sessionType: string;
  createdAt: string;
}

export interface MentorStatistics {
  total: number;
  active: number;
  inactive: number;
  imported: number;
  totalCapacity: number;
  assignedTeams: number;
  availableSlots: number;
  averageTeamsPerMentor: number;
  totalSessions: number;
  totalSessionHours: number;
}

export interface MentorCapacity {
  mentorId: string;
  mentorName: string;
  email: string;
  maxTeams: number;
  assignedTeams: number;
  availableSlots: number;
  verticalScope: string[];
  status: MentorStatus;
}

export interface MentorEarningsSummary {
  totalMentors: number;
  totalCompletedSessions: number;
  totalEarnings: number;
  totalPaid: number;
  totalUnpaid: number;
  currentMonthEarnings: number;
  currentMonthPaid: number;
  currentMonthUnpaid: number;
}

export interface MentorEarnings {
  mentorId: string;
  mentorName: string;
  email: string;
  sessionRate: number;
  confirmedSessions: number;
  completedSessions: number;
  totalEarned: number;
  totalPaid: number;
  unpaidAmount: number;
  currentMonthEarned: number;
  currentMonthPaid: number;
  currentMonthUnpaid: number;
}

export type MentorPaymentStatus = "pending" | "completed" | "failed" | "cancelled";

export interface MentorPayment {
  id: string;
  mentorId: string;
  mentorName: string;
  amount: number;
  status: MentorPaymentStatus;
  sessionsCount: number;
  periodStart?: string;
  periodEnd?: string;
  paidAt?: string;
  paidBy?: string;
  paymentReference?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateMentorDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise?: string[];
  linkedinUrl?: string;
  maxTeams?: number;
  verticalScope?: string[];
  sessionRateOverride?: number;
  cohortId: string;
}

export interface UpdateMentorDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise?: string[];
  linkedinUrl?: string;
  maxTeams?: number;
  verticalScope?: string[];
  sessionRateOverride?: number | null;
  status?: MentorStatus;
}

export interface CreateSessionDto {
  teamId: string;
  sessionDate: string;
  durationMinutes: number;
  notes?: string;
  topicsDiscussed?: string[];
  actionItems?: string[];
  teamProgressNotes?: string;
  nextSessionGoals?: string;
  sessionType?: string;
}

export interface MentorQueryParams {
  cohortId?: string;
  status?: MentorStatus;
  search?: string;
  verticalId?: string;
  hasCapacity?: boolean;
  page?: number;
  limit?: number;
}

// Query keys
const mentorKeys = {
  all: ["mentors"] as const,
  lists: () => [...mentorKeys.all, "list"] as const,
  list: (params: MentorQueryParams) => [...mentorKeys.lists(), params] as const,
  details: () => [...mentorKeys.all, "detail"] as const,
  detail: (id: string) => [...mentorKeys.details(), id] as const,
  statistics: (cohortId?: string) => [...mentorKeys.all, "statistics", cohortId] as const,
  capacity: (cohortId?: string) => [...mentorKeys.all, "capacity", cohortId] as const,
  teams: (mentorId: string) => [...mentorKeys.all, "teams", mentorId] as const,
  sessions: (mentorId: string, teamId?: string) =>
    [...mentorKeys.all, "sessions", mentorId, teamId] as const,
  suggest: (teamId: string) => [...mentorKeys.all, "suggest", teamId] as const,
  myProfile: () => [...mentorKeys.all, "my-profile"] as const,
  myTeams: () => [...mentorKeys.all, "my-teams"] as const,
  mySessions: (teamId?: string) => [...mentorKeys.all, "my-sessions", teamId] as const,
  myScheduledSessions: (teamId?: string) => [...mentorKeys.all, "my-scheduled-sessions", teamId] as const,
};

// ============ Admin Hooks ============

export function useMentors(params: MentorQueryParams = {}) {
  return useQuery({
    queryKey: mentorKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params.status) searchParams.set("status", params.status);
      if (params.search) searchParams.set("search", params.search);
      if (params.verticalId) searchParams.set("verticalId", params.verticalId);
      if (params.hasCapacity !== undefined)
        searchParams.set("hasCapacity", String(params.hasCapacity));
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));

      return api.get<{
        data: Mentor[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/mentors?${searchParams}`);
    },
  });
}

export function useMentor(id: string) {
  return useQuery({
    queryKey: mentorKeys.detail(id),
    queryFn: () => api.get<Mentor>(`/mentors/${id}`),
    enabled: !!id,
  });
}

export function useMentorStatistics(cohortId?: string) {
  return useQuery({
    queryKey: mentorKeys.statistics(cohortId),
    queryFn: () => {
      const url = cohortId ? `/mentors/statistics?cohortId=${cohortId}` : "/mentors/statistics";
      return api.get<MentorStatistics>(url);
    },
  });
}

export function useMentorCapacity(cohortId?: string) {
  return useQuery({
    queryKey: mentorKeys.capacity(cohortId),
    queryFn: () => {
      const url = cohortId ? `/mentors/capacity?cohortId=${cohortId}` : "/mentors/capacity";
      return api.get<MentorCapacity[]>(url);
    },
  });
}

export function useMentorEarningsSummary(cohortId?: string) {
  return useQuery({
    queryKey: [...mentorKeys.all, "earnings-summary", cohortId] as const,
    queryFn: () => {
      const url = cohortId
        ? `/mentor-payments/earnings/summary?cohortId=${cohortId}`
        : "/mentor-payments/earnings/summary";
      return api.get<MentorEarningsSummary>(url);
    },
  });
}

export function useAllScheduledSessions(params: {
  cohortId?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  return useQuery({
    queryKey: [...mentorKeys.all, "all-sessions", params] as const,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params.startDate) searchParams.set("startDate", params.startDate);
      if (params.endDate) searchParams.set("endDate", params.endDate);
      const query = searchParams.toString();
      return api.get<ScheduledSession[]>(`/admin/mentor-sessions${query ? `?${query}` : ""}`);
    },
  });
}

export function useMentorEarnings(mentorId: string) {
  return useQuery({
    queryKey: [...mentorKeys.all, "earnings", mentorId] as const,
    queryFn: () => api.get<MentorEarnings>(`/mentor-payments/earnings/${mentorId}`),
    enabled: !!mentorId,
  });
}

export function useMentorPayments(mentorId: string) {
  return useQuery({
    queryKey: [...mentorKeys.all, "payments", mentorId] as const,
    queryFn: () => api.get<MentorPayment[]>(`/mentor-payments/mentor/${mentorId}`),
    enabled: !!mentorId,
  });
}

export function useMentorTeams(mentorId: string) {
  return useQuery({
    queryKey: mentorKeys.teams(mentorId),
    queryFn: () => api.get<any[]>(`/mentors/${mentorId}/teams`),
    enabled: !!mentorId,
  });
}

export function useMentorSessions(mentorId: string, teamId?: string) {
  return useQuery({
    queryKey: mentorKeys.sessions(mentorId, teamId),
    queryFn: () => {
      const url = teamId
        ? `/mentors/${mentorId}/sessions?teamId=${teamId}`
        : `/mentors/${mentorId}/sessions`;
      return api.get<MentorSession[]>(url);
    },
    enabled: !!mentorId,
  });
}

export function useSuggestedMentors(teamId: string) {
  return useQuery({
    queryKey: mentorKeys.suggest(teamId),
    queryFn: () => api.get<Mentor[]>(`/mentors/team/${teamId}/suggest`),
    enabled: !!teamId,
  });
}

export function useCreateMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateMentorDto) => api.post<Mentor>("/mentors", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.statistics() });
    },
  });
}

export function useUpdateMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMentorDto }) =>
      api.patch<Mentor>(`/mentors/${id}`, dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
    },
  });
}

export function useDeleteMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/mentors/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.statistics() });
    },
  });
}

export function useAssignMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mentorId,
      teamId,
      notes,
    }: {
      mentorId: string;
      teamId: string;
      notes?: string;
    }) => api.post(`/mentors/${mentorId}/assign`, { teamId, notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.teams(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.capacity() });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUnassignMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mentorId,
      teamId,
      reason,
    }: {
      mentorId: string;
      teamId: string;
      reason?: string;
    }) => api.post(`/mentors/${mentorId}/unassign`, { teamId, reason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.teams(variables.mentorId) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.capacity() });
      // Invalidate all team queries to ensure the team detail page refreshes
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      // Also specifically invalidate the team detail
      queryClient.invalidateQueries({ queryKey: ["teams", "detail", variables.teamId] });
    },
  });
}

export function useBulkImportMentors() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cohortId, file }: { cohortId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      // Use apiClient for FormData upload
      const response = await apiClient.post<{
        success: number;
        failed: number;
        errors: Array<{ row: number; email?: string; error: string }>;
        imported: string[];
      }>(`/admin/mentors/import/${cohortId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.statistics() });
    },
  });
}

// ============ Mentor Portal Hooks ============

export function useCurrentMentor() {
  return useQuery({
    queryKey: mentorKeys.myProfile(),
    queryFn: () => api.get<Mentor>("/mentor-portal/me"),
  });
}

// Alias for backward compatibility
export function useMyMentorProfile() {
  return useCurrentMentor();
}

export function useUpdateMyMentorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateMentorDto) =>
      api.patch<Mentor>("/mentor-portal/me", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.myProfile() });
    },
  });
}

export function useMyMentorTeams() {
  return useQuery({
    queryKey: mentorKeys.myTeams(),
    queryFn: () => api.get<any[]>("/mentor-portal/my/teams"),
  });
}

export function useMyMentorSessions(teamId?: string) {
  return useQuery({
    queryKey: mentorKeys.mySessions(teamId),
    queryFn: () => {
      const url = teamId
        ? `/mentor-portal/my/sessions?teamId=${teamId}`
        : "/mentor-portal/my/sessions";
      return api.get<MentorSession[]>(url);
    },
  });
}

export function useMyScheduledSessions(teamId?: string) {
  return useQuery({
    queryKey: mentorKeys.myScheduledSessions(teamId),
    queryFn: () => {
      const url = teamId
        ? `/mentor-portal/sessions?teamId=${teamId}`
        : "/mentor-portal/sessions";
      return api.get<ScheduledSession[]>(url);
    },
  });
}

export function useLogMentorSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateSessionDto) =>
      api.post<MentorSession>("/mentor-portal/my/sessions", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.mySessions() });
    },
  });
}

// ============ Profile Picture Upload ============

export interface UploadResult {
  url: string;
  key: string;
}

export function useUploadMentorProfilePicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mentorId, file }: { mentorId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/mentors/${mentorId}/profile-picture`,
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

      return response.json() as Promise<Mentor>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
    },
  });
}

export function useUploadMyMentorProfilePicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/mentor-portal/me/profile-picture`,
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

      return response.json() as Promise<Mentor>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.myProfile() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.lists() });
    },
  });
}

export function useUploadMentorProfilePictureForNew() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/mentors/upload-profile-picture`,
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

      return response.json() as Promise<UploadResult>;
    },
  });
}


// ============ Mentor Claim Types ============

export type MentorCapability =
  | "retrieval_rag"
  | "computer_vision"
  | "speech_asr"
  | "tabular_ml"
  | "agents"
  | "fine_tuning"
  | "mobile_edge"
  | "data_engineering";

export const MENTOR_CAPABILITY_LABELS: Record<MentorCapability, string> = {
  retrieval_rag: "Retrieval / RAG",
  computer_vision: "Computer Vision",
  speech_asr: "Speech & ASR",
  tabular_ml: "Tabular ML",
  agents: "Agents",
  fine_tuning: "Fine-tuning",
  mobile_edge: "Mobile & Edge",
  data_engineering: "Data Engineering",
};

export type MentorClaimStatus = "active" | "expired" | "completed" | "released" | "swapped";

export type ScheduledSessionStatus =
  | "scheduled"
  | "confirmed"
  | "declined"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

export interface MentorBrowseItem {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  expertise: string[];
  capabilities: MentorCapability[];
  linkedinUrl?: string;
  availableClaimSlots: number;
  isAvailable: boolean;
}

export interface BrowseMentorsResponse {
  data: MentorBrowseItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MentorClaim {
  id: string;
  mentorId: string;
  teamId: string;
  claimedAt: string;
  expiresAt: string;
  status: MentorClaimStatus;
  sessionCount: number; // Completed sessions
  bookedSessionCount: number; // Scheduled/booked sessions
  swapUsed: boolean;
  mentor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    title?: string;
    profileImageUrl?: string;
    capabilities: MentorCapability[];
  };
}

export interface TeamClaimStatus {
  hasClaim: boolean;
  claim?: MentorClaim;
  canSwap: boolean;
  sessionsRemaining: number;
  nextSessionDeadline?: string;
  mentorClaimUnlocked: boolean;
  unlockingStageName?: string;
  unlockingStageReason?: string;
}

export interface ClaimEligibility {
  eligible: boolean;
  reason?: string;
  existingClaim?: MentorClaim;
  teamHasActiveClaim: boolean;
  mentorHasCapacity: boolean;
  mentorClaimUnlocked?: boolean;
  unlockingStageName?: string;
}

export interface ScheduledSession {
  id: string;
  claimId: string;
  mentorId: string;
  teamId: string;
  sessionNumber: number;
  scheduledAt: string;
  durationMinutes: number;
  question: string;
  status: ScheduledSessionStatus;
  googleEventId?: string;
  googleCalendarLink?: string;
  googleMeetLink?: string;
  confirmedByMentor: boolean;
  confirmedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  completedAt?: string;
  notes?: string;
  actionItems: string[];
  mentorFeedback?: string;
  teamFeedback?: string;
  rating?: number;
  mentor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

export interface BrowseMentorsParams {
  capabilities?: MentorCapability[];
  search?: string;
  cohortId?: string;
  page?: number;
  limit?: number;
}

// Query keys for claims
const claimKeys = {
  all: ["mentor-claims"] as const,
  browse: (params: BrowseMentorsParams) => [...claimKeys.all, "browse", params] as const,
  teamStatus: () => [...claimKeys.all, "team-status"] as const,
  eligibility: (mentorId: string) => [...claimKeys.all, "eligibility", mentorId] as const,
  sessions: (claimId: string) => [...claimKeys.all, "sessions", claimId] as const,
};

// ============ Mentor Claim Hooks ============

export function useBrowseMentors(params: BrowseMentorsParams = {}) {
  return useQuery({
    queryKey: claimKeys.browse(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.capabilities?.length) {
        params.capabilities.forEach((c) => searchParams.append("capabilities", c));
      }
      if (params.search) searchParams.set("search", params.search);
      if (params.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));

      return api.get<BrowseMentorsResponse>(`/mentor-claims/browse?${searchParams}`);
    },
  });
}

export function useTeamClaimStatus() {
  return useQuery({
    queryKey: claimKeys.teamStatus(),
    queryFn: () => api.get<TeamClaimStatus>("/mentor-claims/team-status"),
  });
}

export function useClaimEligibility(mentorId: string) {
  return useQuery({
    queryKey: claimKeys.eligibility(mentorId),
    queryFn: () => api.get<ClaimEligibility>(`/mentor-claims/eligibility/${mentorId}`),
    enabled: !!mentorId,
  });
}

export function useClaimMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mentorId,
      proposalSnapshot,
    }: {
      mentorId: string;
      proposalSnapshot?: Record<string, any>;
    }) => api.post<MentorClaim>("/mentor-claims/claim", { mentorId, proposalSnapshot }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useReleaseClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) =>
      api.delete("/mentor-claims/release", { data: { reason } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useSwapMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ newMentorId, reason }: { newMentorId: string; reason?: string }) =>
      api.post<MentorClaim>("/mentor-claims/swap", { newMentorId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// ============ Session Booking Hooks ============

export function useClaimSessions(claimId: string) {
  return useQuery({
    queryKey: claimKeys.sessions(claimId),
    queryFn: () => api.get<ScheduledSession[]>(`/mentor-claims/${claimId}/sessions`),
    enabled: !!claimId,
  });
}

export function useBookSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      claimId,
      date,
      startTime,
      question,
      timezone,
    }: {
      claimId: string;
      date: string;
      startTime: string;
      question: string;
      timezone?: string;
    }) =>
      api.post<ScheduledSession>(`/mentor-claims/${claimId}/sessions`, {
        date,
        startTime,
        question,
        timezone,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: claimKeys.sessions(variables.claimId) });
      queryClient.invalidateQueries({ queryKey: claimKeys.teamStatus() });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      claimId,
      sessionId,
      ...dto
    }: {
      claimId: string;
      sessionId: string;
      scheduledAt?: string;
      question?: string;
      durationMinutes?: number;
    }) => api.put<ScheduledSession>(`/mentor-claims/${claimId}/sessions/${sessionId}`, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: claimKeys.sessions(variables.claimId) });
    },
  });
}

export function useCancelSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      claimId,
      sessionId,
      reason,
    }: {
      claimId: string;
      sessionId: string;
      reason: string;
    }) => api.delete(`/mentor-claims/${claimId}/sessions/${sessionId}`, { data: { reason } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: claimKeys.sessions(variables.claimId) });
      queryClient.invalidateQueries({ queryKey: claimKeys.teamStatus() });
    },
  });
}

export function useRateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      claimId,
      sessionId,
      rating,
      teamFeedback,
    }: {
      claimId: string;
      sessionId: string;
      rating: number;
      teamFeedback?: string;
    }) =>
      api.post<ScheduledSession>(`/mentor-claims/${claimId}/sessions/${sessionId}/rate`, {
        rating,
        teamFeedback,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: claimKeys.sessions(variables.claimId) });
    },
  });
}


// ============ Mentor Portal Session Actions ============

export function useConfirmSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      api.put<ScheduledSession>(`/mentor-portal/sessions/${sessionId}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.myScheduledSessions() });
    },
  });
}

export function useDeclineSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      api.put<ScheduledSession>(`/mentor-portal/sessions/${sessionId}/decline`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.myScheduledSessions() });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      notes,
      actionItems,
      mentorFeedback,
    }: {
      sessionId: string;
      notes?: string;
      actionItems?: string[];
      mentorFeedback?: string;
    }) =>
      api.put<ScheduledSession>(`/mentor-portal/sessions/${sessionId}/complete`, {
        notes,
        actionItems,
        mentorFeedback,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.myScheduledSessions() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.mySessions() });
    },
  });
}
