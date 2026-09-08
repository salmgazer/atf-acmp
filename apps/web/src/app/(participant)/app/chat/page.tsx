"use client";

import { useState, useEffect } from "react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ChannelHeader } from "@/components/chat/channel-header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import {
  useMyChannels,
  useChannel,
  useChatSocket,
  useSendMessage,
  useEditMessage,
  useMarkAsRead,
  type ChatMessage,
} from "@/lib/api/hooks/use-chat";
import { useChatContext } from "@/lib/contexts/chat-context";
import { Loader2, Menu, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function ChatContent() {
  const { token } = useAuthStore();
  const { data: participant, isLoading: participantLoading } = useCurrentParticipant();
  const { data: channels, isLoading: channelsLoading } = useMyChannels();
  
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<
    Map<string, Array<{ userId: string; userName: string }>>
  >(new Map());

  const { data: channel } = useChannel(selectedChannelId || "");
  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const markAsRead = useMarkAsRead();
  const { refreshUnreadCount, setActiveChannelId } = useChatContext();

  // Auto-select channel when channels load
  useEffect(() => {
    if (channels && channels.length > 0 && !hasAutoSelected && !selectedChannelId) {
      // Priority 1: Team channel
      const teamChannel = channels.find((c) => c.channel.type === "team");
      if (teamChannel) {
        setSelectedChannelId(teamChannel.channel.id);
        setHasAutoSelected(true);
        return;
      }

      // Priority 2: General Discussion
      const generalChannel = channels.find(
        (c) => c.channel.type === "announcement" && 
               c.channel.name.toLowerCase().includes("general")
      );
      if (generalChannel) {
        setSelectedChannelId(generalChannel.channel.id);
        setHasAutoSelected(true);
        return;
      }

      // Priority 3: First announcement channel
      const announcementChannel = channels.find((c) => c.channel.type === "announcement");
      if (announcementChannel) {
        setSelectedChannelId(announcementChannel.channel.id);
        setHasAutoSelected(true);
        return;
      }

      // Fallback: First available channel
      if (channels[0]) {
        setSelectedChannelId(channels[0].channel.id);
        setHasAutoSelected(true);
      }
    }
  }, [channels, hasAutoSelected, selectedChannelId]);

  // Update active channel in context
  useEffect(() => {
    setActiveChannelId(selectedChannelId);
    return () => setActiveChannelId(null);
  }, [selectedChannelId, setActiveChannelId]);

  // WebSocket connection
  const socket = useChatSocket({
    token: token || "",
    onTypingStarted: (channelId, userId, userName) => {
      if (userId === participant?.id) return;
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(channelId) || [];
        if (!current.find((u) => u.userId === userId)) {
          newMap.set(channelId, [...current, { userId, userName }]);
        }
        return newMap;
      });
    },
    onTypingStopped: (channelId, userId) => {
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(channelId) || [];
        newMap.set(channelId, current.filter((u) => u.userId !== userId));
        return newMap;
      });
    },
  });

  // Join channel when selected
  useEffect(() => {
    if (selectedChannelId && socket.isConnected) {
      socket.joinChannel(selectedChannelId);
      markAsRead.mutate({ channelId: selectedChannelId }, {
        onSuccess: () => refreshUnreadCount(),
      });
      return () => socket.leaveChannel(selectedChannelId);
    }
  }, [selectedChannelId, socket.isConnected]);

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setHasAutoSelected(true);
    setReplyTo(null);
    setEditingMessage(null);
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string, replyToId?: string) => {
    if (!selectedChannelId) return;

    if (editingMessage) {
      await editMessage.mutateAsync({
        channelId: selectedChannelId,
        messageId: editingMessage.id,
        content,
      });
      setEditingMessage(null);
    } else {
      try {
        await socket.sendMessage(selectedChannelId, content, replyToId);
      } catch {
        await sendMessage.mutateAsync({
          channelId: selectedChannelId,
          dto: { content, replyToId },
        });
      }
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (selectedChannelId) {
      socket.sendTyping(selectedChannelId, isTyping);
    }
  };

  const currentTypingUsers = selectedChannelId
    ? typingUsers.get(selectedChannelId) || []
    : [];

  const isLoading = participantLoading || channelsLoading;

  if (isLoading || !participant) {
    return (
      <div className="flex h-[calc(100vh-180px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-[calc(100vh-180px)] items-center justify-center">
        <p className="text-muted-foreground">Authentication required</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-72 flex-shrink-0">
        <ChatSidebar
          selectedChannelId={selectedChannelId || undefined}
          onSelectChannel={handleSelectChannel}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {selectedChannelId && channel ? (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background">
              <ChannelHeader
                channel={channel}
                isConnected={socket.isConnected}
                onMenuClick={() => setSidebarOpen(true)}
              />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto pb-20">
              <MessageList
                channelId={selectedChannelId}
                currentUserId={participant.id}
                currentUserType="participant"
                onReply={setReplyTo}
                onEdit={setEditingMessage}
                typingUsers={currentTypingUsers}
              />
            </div>

            {/* Input */}
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
            selectedChannelId={selectedChannelId || undefined}
            onSelectChannel={handleSelectChannel}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ParticipantChatPage() {
  return (
    <ProtectedRoute portal="participant">
      <ParticipantLayout>
        <ChatContent />
      </ParticipantLayout>
    </ProtectedRoute>
  );
}
