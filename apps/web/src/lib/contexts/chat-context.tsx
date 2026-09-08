"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/stores/auth-store";

// Staff roles that should exclude team channel notifications
const STAFF_ROLES = ["admin", "super_admin", "program_manager", "reviewer", "evaluator"];

interface ChatContextValue {
  isConnected: boolean;
  totalUnreadCount: number;
  activeChannelId: string | null;
  setActiveChannelId: (channelId: string | null) => void;
  refreshUnreadCount: () => void;
  decrementUnreadCount: (amount?: number) => void;
}

const ChatContext = createContext<ChatContextValue>({
  isConnected: false,
  totalUnreadCount: 0,
  activeChannelId: null,
  setActiveChannelId: () => {},
  refreshUnreadCount: () => {},
  decrementUnreadCount: () => {},
});

export function useChatContext() {
  return useContext(ChatContext);
}

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { token, isAuthenticated, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const tokenRef = useRef(token);
  const userIdRef = useRef(user?.id);
  const userRoleRef = useRef(user?.role);
  const activeChannelIdRef = useRef<string | null>(null);
  
  tokenRef.current = token;
  userIdRef.current = user?.id;
  userRoleRef.current = user?.role;

  // Check if user is staff
  const isStaff = user?.role && STAFF_ROLES.includes(user.role.toLowerCase());

  // Wrapper to set active channel - update both state AND ref immediately
  const setActiveChannelId = useCallback((channelId: string | null) => {
    activeChannelIdRef.current = channelId; // Update ref immediately (sync)
    setActiveChannelIdState(channelId); // Update state (async)
  }, []);

  // Function to fetch and set unread count
  const refreshUnreadCount = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/chat/channels/my`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );
      if (response.ok) {
        const channels = await response.json();
        
        // For staff users, exclude team channels from the nav badge count
        const isUserStaff = userRoleRef.current && STAFF_ROLES.includes(userRoleRef.current.toLowerCase());
        const filteredChannels = isUserStaff
          ? channels.filter((c: any) => c.channel?.type !== "team")
          : channels;
        
        const total = filteredChannels.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
        setTotalUnreadCount(total);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, []);

  // Function to decrement unread count (when reading messages)
  const decrementUnreadCount = useCallback((amount: number = 1) => {
    setTotalUnreadCount((prev) => Math.max(0, prev - amount));
  }, []);

  // Fetch initial unread count
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    refreshUnreadCount();
  }, [isAuthenticated, token, refreshUnreadCount]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!token || !isAuthenticated) return;

    // Avoid reconnecting if already connected
    if (socketRef.current?.connected) {
      return;
    }

    const socketUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
      "http://localhost:3001";

    socketRef.current = io(`${socketUrl}/chat`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Listen for new messages to update unread count
    socket.on("new_message", async ({ channelId, message, channelType }) => {
      // Don't increment if:
      // 1. Message is from the current user
      // 2. User is currently viewing this channel
      // 3. Staff user and message is from a team channel
      const isOwnMessage = message.senderId === userIdRef.current;
      const currentActiveChannel = activeChannelIdRef.current;
      const isViewingChannel = channelId === currentActiveChannel;
      const isUserStaff = userRoleRef.current && STAFF_ROLES.includes(userRoleRef.current.toLowerCase());
      const isTeamChannel = channelType === "team";
      
      // Staff should not get badge notifications for team channels
      const shouldSkipForStaff = isUserStaff && isTeamChannel;
      
      if (!isOwnMessage && !isViewingChannel && !shouldSkipForStaff) {
        setTotalUnreadCount((prev) => prev + 1);
      }
      
      // If viewing this channel, mark as read immediately so the server-side
      // unread count stays at 0 when we invalidate queries
      if (isViewingChannel && !isOwnMessage) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/chat/channels/${channelId}/read`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokenRef.current}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            }
          );
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }
      }
      
      // Invalidate queries so the chat page updates
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", channelId] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, isAuthenticated, queryClient]);

  return (
    <ChatContext.Provider value={{ 
      isConnected, 
      totalUnreadCount, 
      activeChannelId,
      setActiveChannelId,
      refreshUnreadCount, 
      decrementUnreadCount 
    }}>
      {children}
    </ChatContext.Provider>
  );
}
