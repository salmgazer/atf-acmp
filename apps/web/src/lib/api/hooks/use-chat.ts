"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "@/lib/api/client";

// Types
export type ChannelType = "team" | "mentor_team" | "staff" | "announcement" | "direct";
export type SenderType = "participant" | "mentor" | "staff" | "organization" | "system";
export type MessageType = "text" | "image" | "file" | "system";

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  cohortId?: string;
  teamId?: string;
  isPrivate: boolean;
  isArchived: boolean;
  memberCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderType: SenderType;
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  messageType: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
  replyToId?: string;
  replyTo?: ChatMessage;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  reactions: ReactionGroup[];
  createdAt: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  reactors: Array<{ id: string; type: SenderType }>;
}

export interface ChannelMember {
  id: string;
  memberId: string;
  memberType: SenderType;
  memberName: string;
  memberAvatarUrl?: string;
  isAdmin: boolean;
  isMuted: boolean;
  joinedAt: string;
  lastReadAt?: string;
}

export interface ChannelWithUnread {
  channel: ChatChannel;
  latestMessage?: ChatMessage;
  unreadCount: number;
}

export interface SendMessageDto {
  content: string;
  messageType?: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  replyToId?: string;
}

// Query keys
const chatKeys = {
  all: ["chat"] as const,
  channels: () => [...chatKeys.all, "channels"] as const,
  channel: (id: string) => [...chatKeys.all, "channel", id] as const,
  messages: (channelId: string) => [...chatKeys.all, "messages", channelId] as const,
  members: (channelId: string) => [...chatKeys.all, "members", channelId] as const,
};

// ============ REST API Hooks ============

export function useMyChannels() {
  return useQuery({
    queryKey: chatKeys.channels(),
    queryFn: () => api.get<ChannelWithUnread[]>("/chat/channels/my"),
  });
}

export function useChannel(id: string) {
  return useQuery({
    queryKey: chatKeys.channel(id),
    queryFn: () => api.get<ChatChannel>(`/chat/channels/${id}`),
    enabled: !!id,
  });
}

export function useChannelMessages(
  channelId: string,
  options: { limit?: number; before?: string } = {}
) {
  return useQuery({
    queryKey: [...chatKeys.messages(channelId), options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.limit) params.set("limit", String(options.limit));
      if (options.before) params.set("before", options.before);

      return api.get<{
        messages: ChatMessage[];
        hasMore: boolean;
      }>(`/chat/channels/${channelId}/messages?${params}`);
    },
    enabled: !!channelId,
    staleTime: 0, // Always refetch messages when channel is visited
    gcTime: 0, // Don't cache messages to prevent stale data issues
  });
}

export function useChannelMembers(channelId: string) {
  return useQuery({
    queryKey: chatKeys.members(channelId),
    queryFn: () => api.get<ChannelMember[]>(`/chat/channels/${channelId}/members`),
    enabled: !!channelId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, dto }: { channelId: string; dto: SendMessageDto }) =>
      api.post<ChatMessage>(`/chat/channels/${channelId}/messages`, dto),
    onSuccess: (message) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(message.channelId),
      });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
      content,
    }: {
      channelId: string;
      messageId: string;
      content: string;
    }) => api.patch<ChatMessage>(`/chat/channels/${channelId}/messages/${messageId}`, { content }),
    onSuccess: (message) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(message.channelId),
      });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, messageId }: { channelId: string; messageId: string }) => {
      await api.delete(`/chat/channels/${channelId}/messages/${messageId}`);
      return { channelId, messageId };
    },
    onSuccess: ({ channelId }) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(channelId),
      });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, messageId }: { channelId: string; messageId?: string }) => {
      await api.post(`/chat/channels/${channelId}/read`, { messageId });
      return channelId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.channels() });
    },
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      messageId,
      emoji,
    }: {
      channelId: string;
      messageId: string;
      emoji: string;
    }) => {
      await api.post(`/chat/channels/${channelId}/messages/${messageId}/reactions`, { emoji });
      return { channelId };
    },
    onSuccess: ({ channelId }) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(channelId),
      });
    },
  });
}

// ============ WebSocket Hook ============

interface UseChatSocketOptions {
  token: string;
  onNewMessage?: (channelId: string, message: ChatMessage) => void;
  onMessageEdited?: (channelId: string, message: ChatMessage) => void;
  onMessageDeleted?: (channelId: string, messageId: string) => void;
  onTypingStarted?: (channelId: string, userId: string, userName: string) => void;
  onTypingStopped?: (channelId: string, userId: string) => void;
  onMemberJoined?: (channelId: string, member: ChannelMember) => void;
  onMemberLeft?: (channelId: string, memberId: string) => void;
}

export function useChatSocket(options: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Use refs for callbacks to avoid recreating socket on every render
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    if (!options.token) return;
    
    // Avoid reconnecting if already connected with same token
    if (socketRef.current?.connected) {
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || "http://localhost:3001";

    socketRef.current = io(`${socketUrl}/chat`, {
      auth: { token: options.token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("error", (err) => {
      setError(err.message);
    });

    socket.on("new_message", ({ channelId, message }) => {
      // Update cache
      queryClient.setQueryData(chatKeys.messages(channelId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...old.messages, message],
        };
      });
      // Invalidate channel list to update unread
      queryClient.invalidateQueries({ queryKey: chatKeys.channels() });
      callbacksRef.current.onNewMessage?.(channelId, message);
    });

    socket.on("message_edited", ({ channelId, message }) => {
      queryClient.setQueryData(chatKeys.messages(channelId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m: ChatMessage) => (m.id === message.id ? message : m)),
        };
      });
      callbacksRef.current.onMessageEdited?.(channelId, message);
    });

    socket.on("message_deleted", ({ channelId, messageId }) => {
      queryClient.setQueryData(chatKeys.messages(channelId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m: ChatMessage) =>
            m.id === messageId ? { ...m, isDeleted: true, content: "[Message deleted]" } : m
          ),
        };
      });
      callbacksRef.current.onMessageDeleted?.(channelId, messageId);
    });

    socket.on("typing_started", ({ channelId, userId, userName }) => {
      callbacksRef.current.onTypingStarted?.(channelId, userId, userName);
    });

    socket.on("typing_stopped", ({ channelId, userId }) => {
      callbacksRef.current.onTypingStopped?.(channelId, userId);
    });

    socket.on("member_joined", ({ channelId, member }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.members(channelId) });
      callbacksRef.current.onMemberJoined?.(channelId, member);
    });

    socket.on("member_left", ({ channelId, memberId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.members(channelId) });
      callbacksRef.current.onMemberLeft?.(channelId, memberId);
    });

    return () => {
      socket.disconnect();
    };
  }, [options.token, queryClient]);

  const joinChannel = useCallback((channelId: string) => {
    socketRef.current?.emit("join_channel", { channelId });
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketRef.current?.emit("leave_channel", { channelId });
  }, []);

  const sendMessage = useCallback(
    (channelId: string, content: string, replyToId?: string) => {
      return new Promise<ChatMessage>((resolve, reject) => {
        if (!socketRef.current?.connected) {
          reject(new Error("Socket not connected"));
          return;
        }
        
        // Set a timeout in case the server doesn't respond
        const timeout = setTimeout(() => {
          reject(new Error("Message send timeout"));
        }, 10000);
        
        socketRef.current.emit(
          "send_message",
          { channelId, content, replyToId },
          (response: { success: boolean; message?: ChatMessage; error?: string }) => {
            clearTimeout(timeout);
            if (response.success && response.message) {
              resolve(response.message);
            } else {
              reject(new Error(response.error || "Failed to send message"));
            }
          }
        );
      });
    },
    []
  );

  const sendTyping = useCallback((channelId: string, isTyping: boolean) => {
    socketRef.current?.emit("typing", { channelId, isTyping });
  }, []);

  const markRead = useCallback((channelId: string, messageId?: string) => {
    socketRef.current?.emit("mark_read", { channelId, messageId });
  }, []);

  return {
    isConnected,
    error,
    joinChannel,
    leaveChannel,
    sendMessage,
    sendTyping,
    markRead,
  };
}
