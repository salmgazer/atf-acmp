"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Types
export interface MatchingConfig {
  firstChoiceWeight?: number;
  secondChoiceWeight?: number;
  thirdChoiceWeight?: number;
  fourthChoiceWeight?: number;
  fifthChoiceWeight?: number;
  verticalWeight?: number;
  skillOverlapWeight?: number;
  balanceDistribution?: boolean;
  maxTeamsPerBrief?: number;
}

export interface RunMatchingDto {
  config?: MatchingConfig;
  teamIds?: string[];
  briefIds?: string[];
}

export interface ManualAssignment {
  teamId: string;
  briefId: string;
}

export interface FinalizeMatchingDto {
  overrides?: ManualAssignment[];
  excludeTeamIds?: string[];
}

export interface MatchResult {
  teamId: string;
  teamName: string;
  briefId: string;
  briefTitle: string;
  organizationName: string;
  score: number;
  scoreBreakdown: {
    rankingScore: number;
    verticalScore: number;
    skillScore: number;
  };
  rankPosition: number | null;
  verticalMatch: boolean;
  skillOverlap: number;
}

export interface MatchingStats {
  totalTeams: number;
  matchedTeams: number;
  unmatchedTeams: number;
  totalBriefs: number;
  briefsWithTeams: number;
  briefsAtCapacity: number;
  averageScore: number;
  firstChoicePercentage: number;
  topThreePercentage: number;
  matchedToRankedBrief: number;
  matchedToUnrankedBrief: number;
}

export interface MatchingPreview {
  cohortId: string;
  cohortName: string;
  generatedAt: string;
  statistics: MatchingStats;
  matches: MatchResult[];
  unmatchedTeamIds: string[];
  configUsed: MatchingConfig;
  warnings: string[];
}

export interface BriefCapacity {
  briefId: string;
  briefTitle: string;
  organizationName: string;
  verticalName: string | null;
  maxTeams: number;
  currentTeams: number;
  previewTeams: number;
  availableSlots: number;
}

export interface TeamMatchStatus {
  teamId: string;
  teamName: string;
  memberCount: number;
  hasPreferences: boolean;
  rankedBriefIds: string[];
  currentBriefId: string | null;
  previewBriefId: string | null;
  previewScore: number | null;
}

// Query keys
const matchingKeys = {
  all: ["matching"] as const,
  preview: (cohortId: string) => [...matchingKeys.all, "preview", cohortId] as const,
  briefCapacities: (cohortId: string) => [...matchingKeys.all, "brief-capacities", cohortId] as const,
  teamStatus: (cohortId: string) => [...matchingKeys.all, "team-status", cohortId] as const,
};

// Hooks
export function useMatchingPreview(cohortId: string) {
  return useQuery({
    queryKey: matchingKeys.preview(cohortId),
    queryFn: async (): Promise<MatchingPreview | null> => {
      const result = await api.get<MatchingPreview | null>(
        `/admin/cohorts/${cohortId}/matching/preview`
      );
      return result ?? null;
    },
    enabled: !!cohortId,
    staleTime: 0, // Always fetch fresh
  });
}

export function useBriefCapacities(cohortId: string) {
  return useQuery({
    queryKey: matchingKeys.briefCapacities(cohortId),
    queryFn: async (): Promise<BriefCapacity[]> => {
      const result = await api.get<BriefCapacity[]>(
        `/admin/cohorts/${cohortId}/matching/brief-capacities`
      );
      return result ?? [];
    },
    enabled: !!cohortId,
  });
}

export function useTeamMatchStatus(cohortId: string) {
  return useQuery({
    queryKey: matchingKeys.teamStatus(cohortId),
    queryFn: async (): Promise<TeamMatchStatus[]> => {
      const result = await api.get<TeamMatchStatus[]>(
        `/admin/cohorts/${cohortId}/matching/team-status`
      );
      return result ?? [];
    },
    enabled: !!cohortId,
  });
}

export function useRunMatching() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, dto }: { cohortId: string; dto?: RunMatchingDto }) =>
      api.post<MatchingPreview>(`/admin/cohorts/${cohortId}/matching/run`, dto || {}),
    onSuccess: (data) => {
      queryClient.setQueryData(matchingKeys.preview(data.cohortId), data);
      queryClient.invalidateQueries({
        queryKey: matchingKeys.briefCapacities(data.cohortId),
      });
      queryClient.invalidateQueries({
        queryKey: matchingKeys.teamStatus(data.cohortId),
      });
    },
  });
}

export function useFinalizeMatching() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cohortId, dto }: { cohortId: string; dto?: FinalizeMatchingDto }) => {
      const result = await api.post<{ assignedCount: number; errors: string[] }>(
        `/admin/cohorts/${cohortId}/matching/finalize`,
        dto || {}
      );
      return { ...result, cohortId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: matchingKeys.preview(data.cohortId) });
      queryClient.invalidateQueries({
        queryKey: matchingKeys.briefCapacities(data.cohortId),
      });
      queryClient.invalidateQueries({
        queryKey: matchingKeys.teamStatus(data.cohortId),
      });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useClearMatchingPreview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cohortId: string) => {
      await api.delete(`/admin/cohorts/${cohortId}/matching/preview`);
      return cohortId;
    },
    onSuccess: (cohortId) => {
      queryClient.setQueryData(matchingKeys.preview(cohortId), null);
    },
  });
}


// ============ Team Formation Types ============

export interface TeamFormationConfig {
  targetTeamSize?: number;
  prioritizeSkillDiversity?: boolean;
  prioritizeInterestMatch?: boolean;
  preferSameCountry?: boolean;
  balanceByCountry?: boolean;
}

export interface RunTeamFormationDto {
  config?: TeamFormationConfig;
  excludeParticipantIds?: string[];
}

export interface FinalizeTeamFormationDto {
  overrides?: {
    participantId: string;
    assignedTeamIndex: number;
  }[];
  excludeParticipantIds?: string[];
}

export interface ProposedTeam {
  index: number;
  members: {
    participantId: string;
    firstName: string;
    lastName: string;
    country: string;
    skills: string[];
    interests: string[];
    isLead: boolean;
  }[];
  skillDiversity: number;
  interestAlignment: number;
  countryDistribution: Record<string, number>;
}

export interface TeamFormationStats {
  totalEligibleParticipants: number;
  participantsWithPreferences: number;
  participantsWithoutPreferences: number;
  crossCountryWillingCount: number;
  sameCountryPreferredCount: number;
  proposedTeamCount: number;
  averageTeamSize: number;
  averageCompatibilityScore: number;
  crossCountryTeamCount: number;
  sameCountryTeamCount: number;
  unassignedParticipantCount: number;
  countryDistribution: Record<string, number>;
  backfillStats: BackfillStats;
}

export interface BackfillStats {
  undersizedTeamCount: number;
  teamsToBackfillCount: number;
  participantsToBackfillCount: number;
  averageBackfillCompatibility: number;
  teamsStillUndersizedCount: number;
}

export interface TeamFormationPreview {
  cohortId: string;
  cohortName: string;
  generatedAt: string;
  statistics: TeamFormationStats;
  proposedBackfills: ProposedBackfill[];
  proposedTeams: ProposedTeam[];
  unassignedParticipantIds: string[];
  configUsed: TeamFormationConfig;
  warnings: string[];
}

export interface ProposedBackfill {
  teamId: string;
  teamName: string;
  currentMemberCount: number;
  targetSize: number;
  participantIdsToAdd: string[];
  participantsToAdd: {
    id: string;
    participantId: string;
    firstName: string;
    lastName: string;
    country: string;
    skills: string[];
    interests: string[];
  }[];
  compatibilityScore: number;
  introducesCrossCountry: boolean;
}

export interface ParticipantFormationStatus {
  participantId: string;
  participantCode: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  skills: string[];
  interests: string[];
  hasTeam: boolean;
  teamId?: string;
  teamName?: string;
  preferencesComplete: boolean;
}

// Team Formation Query Keys
const teamFormationKeys = {
  all: ["team-formation"] as const,
  preview: (cohortId: string) => [...teamFormationKeys.all, "preview", cohortId] as const,
  participantStatus: (cohortId: string) => [...teamFormationKeys.all, "participant-status", cohortId] as const,
};

// Team Formation Hooks
export function useTeamFormationPreview(cohortId: string) {
  return useQuery({
    queryKey: teamFormationKeys.preview(cohortId),
    queryFn: async (): Promise<TeamFormationPreview | null> => {
      const result = await api.get<TeamFormationPreview | null>(
        `/admin/cohorts/${cohortId}/matching/formation/preview`
      );
      return result ?? null;
    },
    enabled: !!cohortId,
    staleTime: 0,
  });
}

export function useParticipantFormationStatus(cohortId: string) {
  return useQuery({
    queryKey: teamFormationKeys.participantStatus(cohortId),
    queryFn: async (): Promise<ParticipantFormationStatus[]> => {
      const result = await api.get<ParticipantFormationStatus[]>(
        `/admin/cohorts/${cohortId}/matching/formation/participant-status`
      );
      return result ?? [];
    },
    enabled: !!cohortId,
  });
}

export function useRunTeamFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, dto }: { cohortId: string; dto?: RunTeamFormationDto }) =>
      api.post<TeamFormationPreview>(`/admin/cohorts/${cohortId}/matching/formation/run`, dto || {}),
    onSuccess: (data) => {
      queryClient.setQueryData(teamFormationKeys.preview(data.cohortId), data);
      queryClient.invalidateQueries({
        queryKey: teamFormationKeys.participantStatus(data.cohortId),
      });
    },
  });
}

export function useFinalizeTeamFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cohortId, dto }: { cohortId: string; dto?: FinalizeTeamFormationDto }) => {
      const result = await api.post<{ createdTeamCount: number; errors: string[] }>(
        `/admin/cohorts/${cohortId}/matching/formation/finalize`,
        dto || {}
      );
      return { ...result, cohortId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: teamFormationKeys.preview(data.cohortId) });
      queryClient.invalidateQueries({
        queryKey: teamFormationKeys.participantStatus(data.cohortId),
      });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
    },
  });
}

export function useClearTeamFormationPreview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cohortId: string) => {
      await api.delete(`/admin/cohorts/${cohortId}/matching/formation/preview`);
      return cohortId;
    },
    onSuccess: (cohortId) => {
      queryClient.setQueryData(teamFormationKeys.preview(cohortId), null);
    },
  });
}
