"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

// Types
export type TeamStatus =
  | "forming"
  | "active"
  | "submitted"
  | "evaluated"
  | "disqualified";

export type TeamRole = "lead" | "co_lead" | "member";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface TeamMember {
  id: string;
  teamId: string;
  participantId: string;
  participant: {
    id: string;
    participantId: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    institution?: string;
    skills: string[];
  };
  role: TeamRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  status: TeamStatus;
  cohortId: string;
  briefId?: string;
  brief?: {
    id: string;
    title: string;
    organization?: {
      id: string;
      name: string;
      logoUrl?: string;
    };
    vertical?: {
      id: string;
      name: string;
    };
  };
  mentorId?: string;
  mentor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    company?: string;
    title?: string;
    profileImageUrl?: string;
    expertise: string[];
    calendlyLink?: string;
  };
  inviteCode: string;
  disqualificationReason?: string;
  disqualifiedAt?: string;
  members: TeamMember[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  team?: Team;
  participantId: string;
  participant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    country: string;
  };
  invitedBy: string;
  inviter?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: InvitationStatus;
  message?: string;
  invitedAt: string;
  respondedAt?: string;
  expiresAt?: string;
}

export interface TeamQueryParams {
  page?: number;
  limit?: number;
  cohortId?: string;
  status?: TeamStatus;
  briefId?: string;
  search?: string;
  hasbrief?: boolean;
}

export interface PaginatedTeams {
  data: Team[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TeamStatistics {
  total: number;
  forming: number;
  active: number;
  submitted: number;
  evaluated: number;
  disqualified: number;
  withBrief: number;
  withoutBrief: number;
  averageMembers: number;
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  cohortId: string;
  creatorId: string;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
}

export interface SendInvitationDto {
  participantId: string;
  invitedBy: string;
  message?: string;
}

// Query keys
export const teamKeys = {
  all: ["teams"] as const,
  lists: () => [...teamKeys.all, "list"] as const,
  list: (params?: TeamQueryParams) => [...teamKeys.lists(), params] as const,
  details: () => [...teamKeys.all, "detail"] as const,
  detail: (id: string) => [...teamKeys.details(), id] as const,
  my: (participantId: string) => [...teamKeys.all, "my", participantId] as const,
  inviteCode: (code: string) => [...teamKeys.all, "inviteCode", code] as const,
  statistics: (cohortId?: string) => [...teamKeys.all, "statistics", cohortId] as const,
  invitations: (teamId: string) => [...teamKeys.all, "invitations", teamId] as const,
  searchParticipants: (cohortId: string, query: string) =>
    [...teamKeys.all, "search", cohortId, query] as const,
};

export const invitationKeys = {
  all: ["invitations"] as const,
  my: (participantId: string, status?: InvitationStatus) =>
    [...invitationKeys.all, "my", participantId, status] as const,
};

// Hooks - Teams

export function useTeams(params?: TeamQueryParams) {
  return useQuery({
    queryKey: teamKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.cohortId) searchParams.set("cohortId", params.cohortId);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.briefId) searchParams.set("briefId", params.briefId);
      if (params?.search) searchParams.set("search", params.search);
      if (params?.hasbrief !== undefined)
        searchParams.set("hasbrief", String(params.hasbrief));

      return api.get<PaginatedTeams>(`/teams?${searchParams.toString()}`);
    },
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: teamKeys.detail(id),
    queryFn: () => api.get<Team>(`/teams/${id}`),
    enabled: !!id,
  });
}

export function useMyTeam(participantId: string) {
  return useQuery({
    queryKey: teamKeys.my(participantId),
    queryFn: () => api.get<Team | null>(`/teams/my/${participantId}`),
    enabled: !!participantId,
  });
}

export function useTeamByInviteCode(code: string) {
  return useQuery({
    queryKey: teamKeys.inviteCode(code),
    queryFn: () => api.get<Team>(`/teams/invite/${code}`),
    enabled: !!code && code.length === 8,
  });
}

export function useOpenTeams(cohortId: string, search?: string) {
  return useQuery({
    queryKey: [...teamKeys.all, "open", cohortId, search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      return api.get<Team[]>(`/teams/open/${cohortId}?${params.toString()}`);
    },
    enabled: !!cohortId,
  });
}

export function useTeamStatistics(cohortId?: string) {
  return useQuery({
    queryKey: teamKeys.statistics(cohortId),
    queryFn: async () => {
      const url = cohortId
        ? `/teams/statistics?cohortId=${cohortId}`
        : "/teams/statistics";
      return api.get<TeamStatistics>(url);
    },
  });
}

export function useTeamInvitations(teamId: string) {
  return useQuery({
    queryKey: teamKeys.invitations(teamId),
    queryFn: () => api.get<TeamInvitation[]>(`/teams/${teamId}/invitations`),
    enabled: !!teamId,
  });
}

export function useSearchAvailableParticipants(cohortId: string, query: string) {
  return useQuery({
    queryKey: teamKeys.searchParticipants(cohortId, query),
    queryFn: () =>
      api.get<any[]>(
        `/teams/search/participants?cohortId=${cohortId}&query=${encodeURIComponent(query)}`
      ),
    enabled: !!cohortId && query.length >= 2,
  });
}

// Mutations - Teams

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamDto) => api.post<Team>("/teams", data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      queryClient.invalidateQueries({ queryKey: teamKeys.my(variables.creatorId) });
      toast.success("Team created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create team");
    },
  });
}

export function useJoinTeamByCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ inviteCode, participantId }: { inviteCode: string; participantId: string }) =>
      api.post<Team>("/teams/join", { inviteCode, participantId }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      queryClient.invalidateQueries({ queryKey: teamKeys.my(variables.participantId) });
      toast.success(`You've joined ${data.name}!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to join team");
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamDto }) =>
      api.patch<Team>(`/teams/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      queryClient.setQueryData(teamKeys.detail(data.id), data);
      toast.success("Team updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update team");
    },
  });
}

export function useAssignBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, briefId }: { teamId: string; briefId: string }) =>
      api.post<Team>(`/teams/${teamId}/assign-brief`, { briefId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ["briefs"] });
      toast.success("Brief assigned to team");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign brief");
    },
  });
}

export function useUnassignBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) =>
      api.post<Team>(`/teams/${teamId}/unassign-brief`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ["briefs"] });
      toast.success("Brief unassigned from team");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unassign brief");
    },
  });
}

export function useDisqualifyTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      reason,
      disqualifiedBy,
    }: {
      teamId: string;
      reason: string;
      disqualifiedBy: string;
    }) => api.post<Team>(`/teams/${teamId}/disqualify`, { reason, disqualifiedBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      toast.success("Team disqualified");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disqualify team");
    },
  });
}

export function useLeaveTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, participantId }: { teamId: string; participantId: string }) =>
      api.delete(`/teams/${teamId}/members/${participantId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: teamKeys.my(variables.participantId) });
      toast.success("Left team successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to leave team");
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      participantId,
      role,
    }: {
      teamId: string;
      participantId: string;
      role: TeamRole;
    }) => api.patch<TeamMember>(`/teams/${teamId}/members/${participantId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      toast.success("Role updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update role");
    },
  });
}

// Mutations - Invitations

export function useSendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: SendInvitationDto }) =>
      api.post<TeamInvitation>(`/teams/${teamId}/invitations`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invitations(variables.teamId) });
      toast.success("Invitation sent!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });
}

export function useMyInvitations(participantId: string, status?: InvitationStatus) {
  return useQuery({
    queryKey: invitationKeys.my(participantId, status),
    queryFn: () => {
      const url = status
        ? `/invitations/my/${participantId}?status=${status}`
        : `/invitations/my/${participantId}`;
      return api.get<TeamInvitation[]>(url);
    },
    enabled: !!participantId,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => api.post<Team>(`/invitations/${invitationId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.all });
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      toast.success("Invitation accepted! You've joined the team.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to accept invitation");
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      api.post<TeamInvitation>(`/invitations/${invitationId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.all });
      toast.success("Invitation declined");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to decline invitation");
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invitationId, cancelledBy }: { invitationId: string; cancelledBy: string }) =>
      api.post(`/invitations/${invitationId}/cancel`, { cancelledBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      toast.success("Invitation cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });
}
