"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

export interface BriefEvent {
  id: string;
  briefId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  timezone: string;
  durationMinutes: number;
  status: "scheduled" | "cancelled";
  zoomJoinUrl: string | null;
  revision: number;
  attendeeCount?: number;
  deliveryPending?: boolean;
}

export interface BriefEventInput {
  title: string;
  description: string;
  startAt: string;
  timezone: string;
  durationMinutes: number;
}

export interface BriefEventsResponse {
  events: BriefEvent[];
  canManage: boolean;
  zoomConfigured: boolean;
}

const key = (briefId: string) => ["brief-events", briefId] as const;

export function useBriefEvents(briefId: string) {
  return useQuery({
    queryKey: key(briefId),
    queryFn: () => api.get<BriefEventsResponse>(`/brief-events/brief/${briefId}`),
    enabled: !!briefId,
    refetchInterval: 15000,
  });
}

export function useSaveBriefEvent(briefId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BriefEventInput }) => id
      ? api.patch<BriefEvent>(`/brief-events/${id}`, input)
      : api.post<BriefEvent>(`/brief-events/brief/${briefId}`, input),
    onSuccess: (_event, variables) => {
      cache.invalidateQueries({ queryKey: key(briefId) });
      toast.success(variables.id ? "Event updated. Invitations will be updated automatically." : "Event scheduled. Team invitations are being sent.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save the event"),
  });
}

export function useCancelBriefEvent(briefId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<BriefEvent>(`/brief-events/${id}/cancel`),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: key(briefId) });
      toast.success("Event cancelled. Participants will be notified.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not cancel the event"),
  });
}

export async function downloadBriefEventCalendar(id: string) {
  const content = await api.get<string>(`/brief-events/${id}/calendar`, { responseType: "text" });
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "brief-event.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function hostBriefEvent(id: string): Promise<void> {
  const hostWindow = window.open("about:blank", "_blank");
  if (!hostWindow) { toast.error("Allow pop-ups to start the Zoom meeting"); return; }
  hostWindow.opener = null;
  try {
    const result = await api.post<{ startUrl: string }>(`/brief-events/${id}/start`);
    hostWindow.location.replace(result.startUrl);
  } catch (error) {
    hostWindow.close();
    toast.error(error instanceof Error ? error.message : "Could not start the Zoom meeting");
  }
}
