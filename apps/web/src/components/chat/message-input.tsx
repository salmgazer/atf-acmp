"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type ChatMessage } from "@/lib/api/hooks/use-chat";
import {
  Send,
  Paperclip,
  Smile,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_LIST = [
  "😀", "😂", "🥹", "😊", "🤔", "😅", "🙌", "👏",
  "👍", "👎", "❤️", "🔥", "🎉", "✅", "❌", "⭐",
  "💡", "📝", "🚀", "💪", "🤝", "👀", "🙏", "💯",
];

interface MessageInputProps {
  channelId: string;
  replyTo?: ChatMessage | null;
  editingMessage?: ChatMessage | null;
  onSend: (content: string, replyToId?: string) => Promise<void>;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function MessageInput({
  channelId,
  replyTo,
  editingMessage,
  onSend,
  onCancelReply,
  onCancelEdit,
  onTyping,
  disabled,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Set content when editing
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  // Focus when replying
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping?.(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTyping?.(false);
    }, 2000);
  }, [onTyping]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        onTyping?.(false);
      }
    };
  }, [onTyping]);

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping?.(false);
    }

    setIsSending(true);
    try {
      await onSend(trimmedContent, replyTo?.id);
      setContent("");
      onCancelReply?.();
      onCancelEdit?.();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    // Cancel on Escape
    if (e.key === "Escape") {
      if (replyTo) {
        onCancelReply?.();
      }
      if (editingMessage) {
        onCancelEdit?.();
        setContent("");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    handleTyping();
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setContent((prev) => prev + emoji);
      return;
    }

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newContent = content.slice(0, start) + emoji + content.slice(end);
    setContent(newContent);

    // Set cursor position after emoji
    setTimeout(() => {
      input.focus();
      input.selectionStart = input.selectionEnd = start + emoji.length;
    }, 0);

    setShowEmojiPicker(false);
    handleTyping();
  };

  const handleCancel = () => {
    if (editingMessage) {
      onCancelEdit?.();
      setContent("");
    } else if (replyTo) {
      onCancelReply?.();
    }
  };

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Reply/Edit Context */}
      {(replyTo || editingMessage) && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-muted text-sm">
          <div className="flex-1 min-w-0">
            {replyTo && (
              <span className="text-muted-foreground">
                Replying to <span className="font-medium text-foreground">{replyTo.senderName}</span>
              </span>
            )}
            {editingMessage && (
              <span className="text-muted-foreground">Editing message</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input Area - Single line with all controls inside */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-full border px-3 py-1">
        {/* Emoji Picker */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full shrink-0"
              disabled={disabled || isSending}
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="p-1.5 hover:bg-muted rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachment */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0"
          disabled={disabled || isSending}
          title="Attach file"
        >
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write message..."
          disabled={disabled || isSending}
          className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder:text-muted-foreground"
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || disabled || isSending}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0"
        >
          <Send className={cn(
            "h-5 w-5",
            content.trim() ? "text-primary" : "text-muted-foreground"
          )} />
        </Button>
      </div>
    </div>
  );
}
