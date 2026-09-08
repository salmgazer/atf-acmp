"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "@/lib/api/client";

// Types
export type NotificationType =
  | "team_invitation"
  | "team_invitation_accepted"
  | "team_invitation_declined"
  | "team_member_joined"
  | "team_member_left"
  | "mentor_assigned"
  | "mentor_session_scheduled"
  | "mentor_session_reminder"
  | "brief_status_changed"
  | "brief_selected"
  | "submission_received"
  | "submission_deadline"
  | "evaluation_complete"
  | "chat_message"
  | "chat_mention"
  | "forum_reply"
  | "forum_mention"
  | "forum_thread_reply"
  | "announcement"
  | "deadline_reminder"
  | "system_alert";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  summary?: string;
  data?: Record<string, any>;
  actionUrl?: string;
  iconName?: string;
  isRead: boolean;
  readAt?: string;
  priority: NotificationPriority;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationCount {
  total: number;
  unread: number;
}

export interface NotificationPreferences {
  id: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  typeSettings?: Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

// Query keys
const notificationKeys = {
  all: ["notifications"] as const,
  list: (params?: NotificationQueryParams) => [...notificationKeys.all, "list", params] as const,
  count: () => [...notificationKeys.all, "count"] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
};

// ============ Hooks ============

export function useNotifications(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.unreadOnly) searchParams.set("unreadOnly", "true");
      if (params?.type) searchParams.set("type", params.type);

      return api.get<PaginatedNotifications>(`/notifications/my?${searchParams}`);
    },
  });
}

export function useNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: () => api.get<NotificationCount>("/notifications/count"),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.patch<{ count: number }>("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useClearReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<{ count: number }>("/notifications/clear-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ============ Preferences ============

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => api.get<NotificationPreferences>("/notifications/preferences"),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: Partial<NotificationPreferences>) =>
      api.patch<NotificationPreferences>("/notifications/preferences", dto),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationKeys.preferences(), data);
    },
  });
}

// ============ WebSocket Hook ============

interface UseNotificationSocketOptions {
  token: string;
  onNotification?: (notification: Notification) => void;
  onUnreadCountUpdate?: () => void;
}

export function useNotificationSocket(options: UseNotificationSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!options.token) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    socketRef.current = io(`${socketUrl}/notifications`, {
      auth: { token: options.token },
      transports: ["websocket", "polling"],
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("notification", (notification: Notification) => {
      // Update cache
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.count() });

      // Call callback
      options.onNotification?.(notification);
    });

    socket.on("unread_count_updated", () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.count() });
      options.onUnreadCountUpdate?.();
    });

    return () => {
      socket.disconnect();
    };
  }, [options.token, queryClient, options]);

  return { isConnected };
}
