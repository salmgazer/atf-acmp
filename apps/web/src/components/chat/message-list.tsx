"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useChannelMessages,
  useAddReaction,
  useDeleteMessage,
  type ChatMessage,
  type SenderType,
} from "@/lib/api/hooks/use-chat";
import {
  MoreHorizontal,
  Reply,
  Smile,
  Pencil,
  Trash2,
  FileIcon,
  ImageIcon,
  Loader2,
  ChevronUp,
} from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

interface MessageListProps {
  channelId: string;
  currentUserId: string;
  currentUserType: SenderType;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  typingUsers?: Array<{ userId: string; userName: string }>;
}

export function MessageList({
  channelId,
  currentUserId,
  currentUserType,
  onReply,
  onEdit,
  typingUsers = [],
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages directly - no local state caching
  const { data, isLoading, refetch } = useChannelMessages(channelId, {
    limit: 50,
  });

  const addReaction = useAddReaction();
  const deleteMessage = useDeleteMessage();

  const messages = data?.messages || [];

  // Refetch when channel changes
  useEffect(() => {
    refetch();
  }, [channelId, refetch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleReaction = (messageId: string, emoji: string) => {
    addReaction.mutate({ channelId, messageId, emoji });
  };

  const handleDelete = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessage.mutate({ channelId, messageId });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, "yyyy-MM-dd");
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1">
      <div className="p-4 space-y-4">
        {/* Messages grouped by date */}
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey}>
            {/* Date Divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">
                {formatDateDivider(dateKey)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Messages */}
            <div className="space-y-1">
              {dateMessages.map((message, idx) => {
                const prevMessage = idx > 0 ? dateMessages[idx - 1] : null;
                const isConsecutive = !!(
                  prevMessage &&
                  prevMessage.senderId === message.senderId &&
                  new Date(message.createdAt).getTime() -
                    new Date(prevMessage.createdAt).getTime() <
                    5 * 60 * 1000
                ); // 5 minutes

                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isConsecutive={isConsecutive}
                    isOwn={
                      message.senderId === currentUserId &&
                      message.senderType === currentUserType
                    }
                    onReply={() => onReply?.(message)}
                    onEdit={() => onEdit?.(message)}
                    onDelete={() => handleDelete(message.id)}
                    onReaction={(emoji) => handleReaction(message.id, emoji)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
              <span
                className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              />
              <span
                className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].userName} is typing...`
                : typingUsers.length === 2
                ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  isConsecutive: boolean;
  isOwn: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReaction: (emoji: string) => void;
}

function MessageItem({
  message,
  isConsecutive,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onReaction,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);

  if (message.isDeleted) {
    return (
      <div className={cn("py-1", !isConsecutive && "pt-3")}>
        <div className="flex items-center gap-3">
          {!isConsecutive && <div className="w-8" />}
          <div className="text-sm text-muted-foreground italic">
            This message was deleted
          </div>
        </div>
      </div>
    );
  }

  const senderInitials = message.senderName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const senderBadgeColors: Record<SenderType, string> = {
    participant: "",
    mentor: "ring-2 ring-blue-500",
    staff: "ring-2 ring-purple-500",
    organization: "ring-2 ring-orange-500",
    system: "ring-2 ring-gray-500",
  };

  return (
    <div
      className={cn(
        "group relative py-1 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors",
        !isConsecutive && "pt-3"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
        <div className="flex items-start gap-3">
          {/* Avatar (only for first message in consecutive group) */}
          {!isConsecutive ? (
            <Avatar className={cn("h-8 w-8", senderBadgeColors[message.senderType])}>
              <AvatarImage src={message.senderAvatarUrl} />
              <AvatarFallback className="text-xs">{senderInitials}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-8 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {/* Sender name and time */}
            {!isConsecutive && (
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-semibold text-sm">{message.senderName}</span>
                {message.senderType !== "participant" && (
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      message.senderType === "mentor" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                      message.senderType === "staff" && "bg-purple-500/20 text-purple-700 dark:text-purple-400",
                      message.senderType === "organization" && "bg-orange-500/20 text-orange-700 dark:text-orange-400",
                      message.senderType === "system" && "bg-gray-500/20 text-gray-700 dark:text-gray-400"
                    )}
                  >
                    {message.senderType}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.createdAt), "h:mm a")}
                </span>
                {message.isEdited && (
                  <span className="text-xs text-muted-foreground">(edited)</span>
                )}
              </div>
            )}

            {/* Reply reference */}
            {message.replyTo && (
              <div className="flex items-center gap-2 mb-1 pl-2 border-l-2 border-muted-foreground/30">
                <span className="text-xs text-muted-foreground">
                  Replying to <span className="font-medium">{message.replyTo.senderName}</span>
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {message.replyTo.content}
                </span>
              </div>
            )}

            {/* Message content */}
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {/* Attachment */}
            {message.attachmentUrl && (
            <div className="mt-2">
              {message.messageType === "image" ? (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={message.attachmentUrl}
                    alt={message.attachmentName || "Image"}
                    className="max-w-sm max-h-64 rounded-lg border"
                  />
                </a>
              ) : (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <FileIcon className="h-4 w-4" />
                  <span className="text-sm">{message.attachmentName}</span>
                  {message.attachmentSize && (
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(message.attachmentSize)})
                    </span>
                  )}
                </a>
              )}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => onReaction(reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                    "hover:bg-muted"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-muted-foreground">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons (shown on hover) */}
        {showActions && (
          <div className="absolute right-2 top-1 flex items-center gap-1 bg-background border rounded-md shadow-sm">
            {/* Quick reactions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Smile className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="flex gap-1 p-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction(emoji)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {emoji}
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onReply}
                >
                  <Reply className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply</TooltipContent>
            </Tooltip>

            {isOwn && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
