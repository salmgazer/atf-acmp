"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatSidebar } from "./chat-sidebar";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { ChannelHeader } from "./channel-header";
import {
  useChannel,
  useChatSocket,
  useSendMessage,
  useEditMessage,
  useMarkAsRead,
  type ChatMessage,
  type SenderType,
} from "@/lib/api/hooks/use-chat";
import { useChatContext } from "@/lib/contexts/chat-context";
import { Menu, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatViewProps {
  token: string;
  currentUserId: string;
  currentUserType: SenderType;
  defaultChannelId?: string;
  className?: string;
}

export function ChatView({
  token,
  currentUserId,
  currentUserType,
  defaultChannelId,
  className,
}: ChatViewProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
  const [hasUserSelected, setHasUserSelected] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<
    Map<string, Array<{ userId: string; userName: string }>>
  >(new Map());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-select default channel when available (only if user hasn't manually selected one)
  useEffect(() => {
    if (defaultChannelId && !hasUserSelected) {
      setSelectedChannelId(defaultChannelId);
    }
  }, [defaultChannelId, hasUserSelected]);

  const { data: channel } = useChannel(selectedChannelId || "");
  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const markAsRead = useMarkAsRead();
  const { refreshUnreadCount, setActiveChannelId } = useChatContext();

  // Update active channel in context when selected channel changes
  useEffect(() => {
    setActiveChannelId(selectedChannelId || null);
    
    // Clear active channel when component unmounts
    return () => {
      setActiveChannelId(null);
    };
  }, [selectedChannelId, setActiveChannelId]);

  // WebSocket connection
  const socket = useChatSocket({
    token,
    onTypingStarted: (channelId, oderId, userName) => {
      if (oderId === currentUserId) return;
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(channelId) || [];
        if (!current.find((u) => u.userId === oderId)) {
          newMap.set(channelId, [...current, { userId: oderId, userName }]);
        }
        return newMap;
      });
    },
    onTypingStopped: (channelId, userId) => {
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(channelId) || [];
        newMap.set(
          channelId,
          current.filter((u) => u.userId !== userId)
        );
        return newMap;
      });
    },
  });

  // Join channel when selected
  useEffect(() => {
    if (selectedChannelId && socket.isConnected) {
      socket.joinChannel(selectedChannelId);
      // Mark as read when entering channel
      markAsRead.mutate({ channelId: selectedChannelId }, {
        onSuccess: () => {
          // Refresh unread count after marking as read
          refreshUnreadCount();
        },
      });

      return () => {
        socket.leaveChannel(selectedChannelId);
      };
    }
  }, [selectedChannelId, socket.isConnected]);

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setHasUserSelected(true);
    setReplyTo(null);
    setEditingMessage(null);
    setSidebarOpen(false);
  };

  const handleSendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!selectedChannelId) return;

      if (editingMessage) {
        await editMessage.mutateAsync({
          channelId: selectedChannelId,
          messageId: editingMessage.id,
          content,
        });
        setEditingMessage(null);
      } else {
        // Try WebSocket first, fall back to REST
        try {
          await socket.sendMessage(selectedChannelId, content, replyToId);
        } catch {
          await sendMessage.mutateAsync({
            channelId: selectedChannelId,
            dto: { content, replyToId },
          });
        }
      }
    },
    [selectedChannelId, editingMessage, socket, editMessage, sendMessage]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (selectedChannelId) {
        socket.sendTyping(selectedChannelId, isTyping);
      }
    },
    [selectedChannelId, socket]
  );

  const currentTypingUsers = selectedChannelId
    ? typingUsers.get(selectedChannelId) || []
    : [];

  return (
    <div className={cn("flex h-full", className)}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-72 flex-shrink-0">
        <ChatSidebar
          selectedChannelId={selectedChannelId}
          onSelectChannel={handleSelectChannel}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {selectedChannelId && channel ? (
          <>
            {/* Header - sticky at top */}
            <div className="sticky top-0 z-10 bg-background">
              <ChannelHeader
                channel={channel}
                isConnected={socket.isConnected}
                onMenuClick={() => setSidebarOpen(true)}
              />
            </div>

            {/* Messages - scrollable, with padding for input */}
            <div className="flex-1 overflow-y-auto pb-20">
              <MessageList
                channelId={selectedChannelId}
                currentUserId={currentUserId}
                currentUserType={currentUserType}
                onReply={setReplyTo}
                onEdit={setEditingMessage}
                typingUsers={currentTypingUsers}
              />
            </div>

            {/* Input - fixed at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t">
              <MessageInput
                channelId={selectedChannelId}
                replyTo={replyTo}
                editingMessage={editingMessage}
                onSend={handleSendMessage}
                onCancelReply={() => setReplyTo(null)}
                onCancelEdit={() => setEditingMessage(null)}
                onTyping={handleTyping}
              />
            </div>
          </>
        ) : (
          // No channel selected
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Select a channel to start chatting</p>
            <p className="text-sm">Choose a channel from the sidebar</p>
            <Button
              variant="outline"
              className="mt-4 md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4 mr-2" />
              View Channels
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <ChatSidebar
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
