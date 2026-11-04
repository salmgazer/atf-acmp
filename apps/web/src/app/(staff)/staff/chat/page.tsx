"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useStaffCohortStore } from "@/lib/stores";
import {
  useMyChannels,
  useChannelMessages,
  useChannelMembers,
  useSendMessage,
  useMarkAsRead,
  type ChatChannel,
  type ChatMessage,
  type ChannelWithUnread,
} from "@/lib/api/hooks/use-chat";
import { useChatContext } from "@/lib/contexts/chat-context";
import {
  MessageSquare,
  Send,
  Users,
  Search,
  Hash,
  Lock,
  Paperclip,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatMessageDate(date: string) {
  const d = new Date(date);
  if (isToday(d)) {
    return format(d, "h:mm a");
  } else if (isYesterday(d)) {
    return `Yesterday at ${format(d, "h:mm a")}`;
  }
  return format(d, "MMM d, h:mm a");
}

function formatChannelTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) {
    return format(d, "h:mm a");
  } else if (isYesterday(d)) {
    return "Yesterday";
  }
  return format(d, "MMM d");
}

function ChannelList({
  channels,
  selectedChannelId,
  onSelectChannel,
  isLoading,
}: {
  channels: ChannelWithUnread[];
  selectedChannelId: string | null;
  onSelectChannel: (channel: ChatChannel) => void;
  isLoading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChannels = channels.filter((c) =>
    c.channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const forumChannels = filteredChannels.filter((c) => c.channel.type === "announcement");
  const teamChannels = filteredChannels.filter((c) => c.channel.type === "team");
  const staffChannels = filteredChannels.filter((c) => c.channel.type === "staff");
  const directChannels = filteredChannels.filter((c) => c.channel.type === "direct");

  const ChannelGroup = ({
    title,
    items,
  }: {
    title: string;
    items: ChannelWithUnread[];
  }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <h3 className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          {title}
        </h3>
        <div className="space-y-0.5">
          {items.map(({ channel, latestMessage, unreadCount }) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                selectedChannelId === channel.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {channel.isPrivate ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{channel.name}</span>
                  {latestMessage && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatChannelTime(latestMessage.createdAt)}
                    </span>
                  )}
                </div>
                {latestMessage && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    <span className="font-medium">{latestMessage.senderName.split(" ")[0]}:</span>{" "}
                    {latestMessage.content}
                  </p>
                )}
              </div>
              {unreadCount > 0 && selectedChannelId !== channel.id && (
                <span className="flex-shrink-0 bg-primary text-primary-foreground text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No channels found</p>
          </div>
        ) : (
          <>
            <ChannelGroup title="Forum" items={forumChannels} />
            <ChannelGroup title="Staff Channels" items={staffChannels} />
            <ChannelGroup title="Team Channels" items={teamChannels} />
            <ChannelGroup title="Direct Messages" items={directChannels} />
          </>
        )}
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  const isSystem = message.senderType === "system";
  const isDeleted = message.isDeleted;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 py-2 px-4 hover:bg-muted/50 transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
        {message.senderAvatarUrl ? (
          <img
            src={message.senderAvatarUrl}
            alt={message.senderName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          message.senderName.charAt(0).toUpperCase()
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-foreground">{message.senderName}</span>
          {message.senderType && message.senderType !== "system" && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                message.senderType === "participant" && "bg-green-500/20 text-green-700 dark:text-green-400",
                message.senderType === "mentor" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                message.senderType === "staff" && "bg-purple-500/20 text-purple-700 dark:text-purple-400",
                message.senderType === "organization" && "bg-orange-500/20 text-orange-700 dark:text-orange-400"
              )}
            >
              {message.senderType}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatMessageDate(message.createdAt)}
          </span>
          {message.isEdited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>
        <p className={cn("text-sm mt-0.5", isDeleted ? "text-muted-foreground italic" : "text-foreground")}>
          {message.content}
        </p>

        {/* Attachment */}
        {message.attachmentUrl && !isDeleted && (
          <div className="mt-2">
            {message.messageType === "image" ? (
              <img
                src={message.attachmentUrl}
                alt={message.attachmentName || "Image"}
                className="max-w-sm rounded-lg border border-border"
              />
            ) : (
              <a
                href={message.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
              >
                <Paperclip className="h-4 w-4" />
                {message.attachmentName || "Attachment"}
              </a>
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs hover:bg-muted/80 transition-colors"
              >
                <span>{reaction.emoji}</span>
                <span className="text-muted-foreground">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({
  channel,
  onBack,
}: {
  channel: ChatChannel;
  onBack?: () => void;
}) {
  const { user } = useAuthStore();
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messagesData, isLoading: messagesLoading } = useChannelMessages(channel.id, {
    limit: 50,
  });
  const { data: members } = useChannelMembers(channel.id);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  const messages = messagesData?.messages || [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark as read when viewing channel
  useEffect(() => {
    if (channel.id) {
      markAsRead.mutate({ channelId: channel.id });
    }
  }, [channel.id]);

  const handleSend = useCallback(async () => {
    const content = messageInput.trim();
    if (!content || sendMessage.isPending) return;

    setMessageInput("");
    try {
      await sendMessage.mutateAsync({
        channelId: channel.id,
        dto: { content },
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageInput(content); // Restore on error
    }
  }, [messageInput, channel.id, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              {channel.isPrivate ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Hash className="h-4 w-4 text-muted-foreground" />
              )}
              <h2 className="font-semibold text-foreground">{channel.name}</h2>
            </div>
            {channel.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{channel.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Users className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground">No messages yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Be the first to send a message in this channel
            </p>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Fixed Input Area - Embedded send button */}
      <div className="flex-shrink-0 p-3 border-t border-border/50 bg-card">
        <div className="flex items-center gap-2 bg-muted/50 rounded-full border px-4 py-1.5">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channel.name}`}
            className="flex-1 bg-transparent border-none outline-none text-sm py-1.5 placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!messageInput.trim() || sendMessage.isPending}
            className="p-1.5 rounded-full hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Send className={cn(
                "h-5 w-5",
                messageInput.trim() ? "text-primary" : "text-muted-foreground"
              )} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Chat</h2>
      <p className="text-muted-foreground max-w-md">
        Select a channel from the sidebar to start chatting with team members, mentors, or other
        staff.
      </p>
    </div>
  );
}

function ChatContent() {
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const { setActiveChannelId } = useChatContext();
  
  // Get global cohort from store
  const { globalCohortId, globalCohort, cohorts } = useStaffCohortStore();
  
  // Local cohort override - initialized from global
  const [localCohortId, setLocalCohortId] = useState<string | undefined>(undefined);
  
  // Initialize local cohort from global when component mounts or global changes
  useEffect(() => {
    if (globalCohortId && localCohortId === undefined) {
      setLocalCohortId(globalCohortId);
    }
  }, [globalCohortId, localCohortId]);
  
  // Use local cohort for filtering (falls back to global if not set)
  const effectiveCohortId = localCohortId || globalCohortId || undefined;
  
  const { data: channels, isLoading } = useMyChannels(effectiveCohortId);

  // Update active channel in context when selected channel changes
  useEffect(() => {
    setActiveChannelId(selectedChannel?.id || null);
    
    // Clear active channel when component unmounts
    return () => {
      setActiveChannelId(null);
    };
  }, [selectedChannel?.id, setActiveChannelId]);
  
  // Reset selected channel when cohort changes
  useEffect(() => {
    setSelectedChannel(null);
    setMobileShowChat(false);
  }, [effectiveCohortId]);

  const handleSelectChannel = (channel: ChatChannel) => {
    setSelectedChannel(channel);
    setMobileShowChat(true);
  };

  const handleBack = () => {
    setMobileShowChat(false);
  };

  return (
    <div className="space-y-4">
      {/* Cohort Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by cohort:</span>
        <Select
          value={effectiveCohortId || "all"}
          onValueChange={(value) => setLocalCohortId(value === "all" ? undefined : value)}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All cohorts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cohorts</SelectItem>
            {cohorts.map((cohort) => (
              <SelectItem key={cohort.id} value={cohort.id}>
                {cohort.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="h-[calc(90vh-12rem)] flex rounded-xl border border-border/50 bg-card overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            "w-full lg:w-80 border-r border-border/50 bg-background",
            mobileShowChat ? "hidden lg:block" : "block"
          )}
        >
          <ChannelList
            channels={channels || []}
            selectedChannelId={selectedChannel?.id || null}
            onSelectChannel={handleSelectChannel}
            isLoading={isLoading}
          />
        </div>

        {/* Chat View */}
        <div
          className={cn(
            "flex-1 bg-background",
            mobileShowChat ? "block" : "hidden lg:block"
          )}
        >
          {selectedChannel ? (
            <ChatView channel={selectedChannel} onBack={handleBack} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

export default function StaffChatPage() {
  return (
    <ProtectedRoute portal="staff">
      <StaffLayout>
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chat</h1>
            <p className="text-muted-foreground mt-1">
              Communicate with teams, mentors, and staff
            </p>
          </div>

          {/* Chat Interface */}
          <ChatContent />
        </div>
      </StaffLayout>
    </ProtectedRoute>
  );
}
