"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

// ============ Types ============

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.SUNDAY]: "Sunday",
  [DayOfWeek.MONDAY]: "Monday",
  [DayOfWeek.TUESDAY]: "Tuesday",
  [DayOfWeek.WEDNESDAY]: "Wednesday",
  [DayOfWeek.THURSDAY]: "Thursday",
  [DayOfWeek.FRIDAY]: "Friday",
  [DayOfWeek.SATURDAY]: "Saturday",
};

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: DayOfWeek;
  dayName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
  timezone: string;
  slotCount: number;
}

export interface WeeklyAvailability {
  mentorId: string;
  mentorName: string;
  slots: AvailabilitySlot[];
  totalWeeklySlots: number;
  defaultTimezone: string;
}

export interface CreateAvailabilitySlotDto {
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  durationMinutes?: number;
  bufferMinutes?: number;
  timezone?: string;
}

export interface UpdateAvailabilitySlotDto {
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  isActive?: boolean;
  timezone?: string;
}

export interface SetWeeklyAvailabilityDto {
  slots: CreateAvailabilitySlotDto[];
  defaultTimezone?: string;
}

export interface AvailabilityException {
  id: string;
  date: string;
  isUnavailable: boolean;
  customSlots?: {
    startTime: string;
    endTime: string;
    durationMinutes?: number;
  }[];
  reason?: string;
}

export interface CreateExceptionDto {
  date: string;
  isUnavailable?: boolean;
  customSlots?: {
    startTime: string;
    endTime: string;
    durationMinutes?: number;
  }[];
  reason?: string;
}

export interface CreateDateRangeExceptionDto {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface BookableSlot {
  date: string;
  dayOfWeek: DayOfWeek;
  dayName: string;
  startTime: string;
  endTime: string;
  startDateTime: string;
  endDateTime: string;
  durationMinutes: number;
  isAvailable: boolean;
  timezone: string;
}

export interface AvailableSlotsResponse {
  mentorId: string;
  mentorName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  slots: BookableSlot[];
  slotsByDate: Record<string, BookableSlot[]>;
}

// ============ Mentor Portal Hooks (for mentors managing their own availability) ============

/**
 * Get current mentor's weekly availability
 */
export function useMyAvailability() {
  return useQuery({
    queryKey: ["my-availability"],
    queryFn: () => api.get<WeeklyAvailability>("/mentor/availability"),
  });
}

/**
 * Set entire weekly availability (replaces existing)
 */
export function useSetMyAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: SetWeeklyAvailabilityDto) =>
      api.put<WeeklyAvailability>("/mentor/availability", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-availability"] });
    },
  });
}

/**
 * Add a single availability slot
 */
export function useAddAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateAvailabilitySlotDto) =>
      api.post<AvailabilitySlot>("/mentor/availability/slots", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-availability"] });
    },
  });
}

/**
 * Update an availability slot
 */
export function useUpdateAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slotId, ...dto }: UpdateAvailabilitySlotDto & { slotId: string }) =>
      api.put<AvailabilitySlot>(`/mentor/availability/slots/${slotId}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-availability"] });
    },
  });
}

/**
 * Delete an availability slot
 */
export function useDeleteAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slotId: string) => api.delete(`/mentor/availability/slots/${slotId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-availability"] });
    },
  });
}

/**
 * Get mentor's availability exceptions
 */
export function useMyExceptions(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  return useQuery({
    queryKey: ["my-exceptions", startDate, endDate],
    queryFn: () =>
      api.get<AvailabilityException[]>(`/mentor/availability/exceptions?${params.toString()}`),
  });
}

/**
 * Add an availability exception
 */
export function useAddException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateExceptionDto) =>
      api.post<AvailabilityException>("/mentor/availability/exceptions", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-exceptions"] });
    },
  });
}

/**
 * Add date range exception (vacation)
 */
export function useAddDateRangeException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateDateRangeExceptionDto) =>
      api.post<AvailabilityException[]>("/mentor/availability/exceptions/range", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-exceptions"] });
    },
  });
}

/**
 * Delete an exception
 */
export function useDeleteException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exceptionId: string) =>
      api.delete(`/mentor/availability/exceptions/${exceptionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-exceptions"] });
    },
  });
}

// ============ Public Hooks (for teams viewing mentor availability) ============

/**
 * Get a mentor's weekly availability
 */
export function useMentorAvailability(mentorId: string) {
  return useQuery({
    queryKey: ["mentor-availability", mentorId],
    queryFn: () => api.get<WeeklyAvailability>(`/mentors/${mentorId}/availability`),
    enabled: !!mentorId,
  });
}

/**
 * Get available (bookable) slots for a mentor
 */
export function useMentorAvailableSlots(
  mentorId: string,
  startDate: string,
  endDate: string,
  timezone?: string
) {
  const params = new URLSearchParams({
    startDate,
    endDate,
    ...(timezone && { timezone }),
  });

  return useQuery({
    queryKey: ["mentor-available-slots", mentorId, startDate, endDate, timezone],
    queryFn: () =>
      api.get<AvailableSlotsResponse>(`/mentors/${mentorId}/availability/slots?${params.toString()}`),
    enabled: !!mentorId && !!startDate && !!endDate,
  });
}
