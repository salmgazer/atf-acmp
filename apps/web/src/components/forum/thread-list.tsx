"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useForumThreads,
  useForumCategory,
  type ForumThread,
  type ForumAuthorType,
} from "@/lib/api/hooks/use-forum";
import {
  Search,
  Plus,
  Pin,
  Lock,
  MessageCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ThreadListProps {
  categoryId: string;
  basePath?: string;
  onNewThread?: () => void;
}

export function ThreadList({
  categoryId,
  basePath = "/app/forum",
  onNewThread,
}: ThreadListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data: category, isLoading: categoryLoading } = useForumCategory(categoryId);
  const { data, isLoading, error } = useForumThreads(categoryId, {
    page,
    limit: 20,
    search: search || undefined,
    pinnedFirst: true,
  });

  if (categoryLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load threads
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={basePath}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Categories
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{category?.name}</h1>
          {category?.description && (
            <p className="text-sm text-muted-foreground">{category.description}</p>
          )}
        </div>
        {!category?.isLocked && (
          <Button onClick={onNewThread}>
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search threads..."
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Threads */}
      {data?.data && data.data.length > 0 ? (
        <div className="space-y-2">
          {data.data.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} basePath={basePath} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            {search ? "No threads match your search" : "No threads yet. Be the first to post!"}
          </p>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} threads)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadCard({
  thread,
  basePath,
}: {
  thread: ForumThread;
  basePath: string;
}) {
  const authorInitials = thread.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const authorBadgeColor: Record<ForumAuthorType, string> = {
    participant: "",
    mentor: "bg-blue-100 text-blue-700",
    staff: "bg-purple-100 text-purple-700",
  };

  return (
    <Link
      href={`${basePath}/thread/${thread.id}`}
      className={cn(
        "block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50",
        thread.isPinned && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar className="h-9 w-9">
          <AvatarImage src={thread.authorAvatarUrl} />
          <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {thread.isPinned && (
              <Pin className="h-3.5 w-3.5 text-primary" />
            )}
            {thread.isLocked && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <h3 className="font-medium truncate">{thread.title}</h3>
          </div>

          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className="font-medium">{thread.authorName}</span>
            {thread.authorType !== "participant" && (
              <span
                className={cn(
                  "text-[10px] uppercase px-1.5 py-0.5 rounded",
                  authorBadgeColor[thread.authorType]
                )}
              >
                {thread.authorType}
              </span>
            )}
            <span>•</span>
            <span>
              {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
            </span>
            {thread.isEdited && <span className="text-xs">(edited)</span>}
          </div>

          {/* Preview of content */}
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {thread.content.replace(/<[^>]+>/g, "").slice(0, 200)}
          </p>
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>{thread.replyCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>{thread.viewCount}</span>
          </div>
        </div>
      </div>

      {/* Last reply info */}
      {thread.lastReplyAt && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          Last reply by <span className="font-medium">{thread.lastReplyAuthorName}</span>{" "}
          {formatDistanceToNow(new Date(thread.lastReplyAt), { addSuffix: true })}
        </div>
      )}
    </Link>
  );
}
