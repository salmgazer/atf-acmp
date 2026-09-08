"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useForumThread,
  useCreateReply,
  useDeleteReply,
  useMarkAsSolution,
  type ForumReply,
  type ForumAuthorType,
} from "@/lib/api/hooks/use-forum";
import {
  ArrowLeft,
  Pin,
  Lock,
  MessageCircle,
  Eye,
  MoreHorizontal,
  Reply,
  Trash2,
  Check,
  CheckCircle,
  Loader2,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ThreadDetailProps {
  threadId: string;
  basePath?: string;
  currentUserId: string;
  currentUserType: ForumAuthorType;
  isStaff?: boolean;
}

export function ThreadDetail({
  threadId,
  basePath = "/app/forum",
  currentUserId,
  currentUserType,
  isStaff = false,
}: ThreadDetailProps) {
  const { data: thread, isLoading, error } = useForumThread(threadId);
  const [replyContent, setReplyContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const createReply = useCreateReply();
  const deleteReply = useDeleteReply();
  const markAsSolution = useMarkAsSolution();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Thread not found
      </div>
    );
  }

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    try {
      await createReply.mutateAsync({
        threadId,
        dto: {
          content: replyContent,
          parentReplyId: replyingTo || undefined,
        },
      });
      setReplyContent("");
      setReplyingTo(null);
      toast.success("Reply posted");
    } catch (error) {
      toast.error("Failed to post reply");
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm("Are you sure you want to delete this reply?")) return;

    try {
      await deleteReply.mutateAsync({ id: replyId, threadId });
      toast.success("Reply deleted");
    } catch (error) {
      toast.error("Failed to delete reply");
    }
  };

  const handleMarkSolution = async (replyId: string) => {
    try {
      await markAsSolution.mutateAsync({ threadId, replyId });
      toast.success("Marked as solution");
    } catch (error) {
      toast.error("Failed to mark as solution");
    }
  };

  const canMarkSolution =
    thread.authorId === currentUserId || isStaff;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={basePath}
          className="text-muted-foreground hover:text-foreground"
        >
          Forum
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`${basePath}/category/${thread.category.id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {thread.category.name}
        </Link>
      </div>

      {/* Thread Header */}
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <AuthorAvatar
              name={thread.authorName}
              avatarUrl={thread.authorAvatarUrl}
              authorType={thread.authorType}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {thread.isPinned && (
                  <Badge variant="outline" className="gap-1">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </Badge>
                )}
                {thread.isLocked && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 text-xl font-bold">{thread.title}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span className="font-medium">{thread.authorName}</span>
                <AuthorBadge authorType={thread.authorType} />
                <span>•</span>
                <span>{format(new Date(thread.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                {thread.isEdited && (
                  <span className="text-xs">(edited)</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                {thread.replyCount}
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {thread.viewCount}
              </div>
            </div>
          </div>

          {/* Thread Content */}
          <div className="mt-6 prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: thread.content }} />
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="font-semibold">
          {thread.replyCount} {thread.replyCount === 1 ? "Reply" : "Replies"}
        </h2>

        {thread.replies.map((reply) => (
          <ReplyCard
            key={reply.id}
            reply={reply}
            currentUserId={currentUserId}
            currentUserType={currentUserType}
            isStaff={isStaff}
            canMarkSolution={canMarkSolution}
            onReply={() => setReplyingTo(reply.id)}
            onDelete={() => handleDeleteReply(reply.id)}
            onMarkSolution={() => handleMarkSolution(reply.id)}
          />
        ))}

        {thread.replies.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No replies yet. Be the first to respond!
          </div>
        )}
      </div>

      {/* Reply Form */}
      {!thread.isLocked && (
        <div className="rounded-lg border bg-card p-4">
          {replyingTo && (
            <div className="mb-3 p-2 rounded bg-muted flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Replying to a comment...
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
          <Textarea
            placeholder="Write your reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={4}
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleSubmitReply}
              disabled={!replyContent.trim() || createReply.isPending}
            >
              {createReply.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Post Reply
            </Button>
          </div>
        </div>
      )}

      {thread.isLocked && (
        <div className="rounded-lg border bg-muted/50 p-4 text-center text-muted-foreground">
          <Lock className="h-5 w-5 mx-auto mb-2" />
          This thread is locked. No new replies can be added.
        </div>
      )}
    </div>
  );
}

function ReplyCard({
  reply,
  currentUserId,
  currentUserType,
  isStaff,
  canMarkSolution,
  onReply,
  onDelete,
  onMarkSolution,
}: {
  reply: ForumReply;
  currentUserId: string;
  currentUserType: ForumAuthorType;
  isStaff: boolean;
  canMarkSolution: boolean;
  onReply: () => void;
  onDelete: () => void;
  onMarkSolution: () => void;
}) {
  const isOwn =
    reply.authorId === currentUserId && reply.authorType === currentUserType;
  const canDelete = isOwn || isStaff;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        reply.isSolution && "border-green-500 bg-green-50 dark:bg-green-950/20",
        reply.parentReplyId && "ml-8 border-l-4"
      )}
    >
      <div className="flex items-start gap-3">
        <AuthorAvatar
          name={reply.authorName}
          avatarUrl={reply.authorAvatarUrl}
          authorType={reply.authorType}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{reply.authorName}</span>
            <AuthorBadge authorType={reply.authorType} />
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
            </span>
            {reply.isEdited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {reply.isSolution && (
              <Badge className="gap-1 bg-green-600">
                <CheckCircle className="h-3 w-3" />
                Solution
              </Badge>
            )}
          </div>

          <div className="mt-2 prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: reply.content }} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReply}>
              <Reply className="h-4 w-4 mr-1" />
              Reply
            </Button>
            {canMarkSolution && !reply.isSolution && (
              <Button variant="ghost" size="sm" onClick={onMarkSolution}>
                <Check className="h-4 w-4 mr-1" />
                Mark as Solution
              </Button>
            )}
          </div>
        </div>

        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function AuthorAvatar({
  name,
  avatarUrl,
  authorType,
  size = "md",
}: {
  name: string;
  avatarUrl?: string;
  authorType: ForumAuthorType;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ringColors: Record<ForumAuthorType, string> = {
    participant: "",
    mentor: "ring-2 ring-blue-500",
    staff: "ring-2 ring-purple-500",
  };

  return (
    <Avatar
      className={cn(
        ringColors[authorType],
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      )}
    >
      <AvatarImage src={avatarUrl} />
      <AvatarFallback className={size === "sm" ? "text-xs" : "text-sm"}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function AuthorBadge({ authorType }: { authorType: ForumAuthorType }) {
  if (authorType === "participant") return null;

  const colors: Record<ForumAuthorType, string> = {
    participant: "",
    mentor: "bg-blue-100 text-blue-700",
    staff: "bg-purple-100 text-purple-700",
  };

  return (
    <span
      className={cn(
        "text-[10px] uppercase font-medium px-1.5 py-0.5 rounded",
        colors[authorType]
      )}
    >
      {authorType}
    </span>
  );
}
