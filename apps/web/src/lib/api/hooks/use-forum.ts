"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Types
export type ForumAuthorType = "participant" | "mentor" | "staff";

export interface ForumCategory {
  id: string;
  name: string;
  description?: string;
  cohortId: string;
  verticalId?: string;
  iconName?: string;
  sortOrder: number;
  isActive: boolean;
  staffOnly: boolean;
  isLocked: boolean;
  threadCount: number;
  lastActivity?: string;
  createdAt: string;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  authorId: string;
  authorType: ForumAuthorType;
  authorName: string;
  authorAvatarUrl?: string;
  isPinned: boolean;
  isLocked: boolean;
  isEdited: boolean;
  editedAt?: string;
  replyCount: number;
  lastReplyAt?: string;
  lastReplyAuthorName?: string;
  viewCount: number;
  createdAt: string;
}

export interface ForumReply {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorType: ForumAuthorType;
  authorName: string;
  authorAvatarUrl?: string;
  parentReplyId?: string;
  isEdited: boolean;
  editedAt?: string;
  isSolution: boolean;
  createdAt: string;
}

export interface ThreadDetail extends ForumThread {
  replies: ForumReply[];
  category: {
    id: string;
    name: string;
  };
}

export interface PaginatedThreads {
  data: ForumThread[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateThreadDto {
  categoryId: string;
  title: string;
  content: string;
}

export interface UpdateThreadDto {
  title?: string;
  content?: string;
}

export interface CreateReplyDto {
  content: string;
  parentReplyId?: string;
}

export interface ThreadQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  pinnedFirst?: boolean;
}

// Query keys
const forumKeys = {
  all: ["forum"] as const,
  categories: (cohortId: string) => [...forumKeys.all, "categories", cohortId] as const,
  category: (id: string) => [...forumKeys.all, "category", id] as const,
  threads: (categoryId: string, params?: ThreadQueryParams) =>
    [...forumKeys.all, "threads", categoryId, params] as const,
  thread: (id: string) => [...forumKeys.all, "thread", id] as const,
};

// ============ Category Hooks ============

export function useForumCategories(cohortId: string, verticalId?: string) {
  return useQuery({
    queryKey: forumKeys.categories(cohortId),
    queryFn: async () => {
      const params = new URLSearchParams({ cohortId });
      if (verticalId) params.set("verticalId", verticalId);

      return api.get<ForumCategory[]>(`/forum/categories?${params}`);
    },
    enabled: !!cohortId,
  });
}

export function useForumCategory(id: string) {
  return useQuery({
    queryKey: forumKeys.category(id),
    queryFn: () => api.get<ForumCategory>(`/forum/categories/${id}`),
    enabled: !!id,
  });
}

// ============ Thread Hooks ============

export function useForumThreads(categoryId: string, params?: ThreadQueryParams) {
  return useQuery({
    queryKey: forumKeys.threads(categoryId, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.search) searchParams.set("search", params.search);
      if (params?.pinnedFirst !== undefined)
        searchParams.set("pinnedFirst", String(params.pinnedFirst));

      return api.get<PaginatedThreads>(`/forum/categories/${categoryId}/threads?${searchParams}`);
    },
    enabled: !!categoryId,
  });
}

export function useForumThread(id: string) {
  return useQuery({
    queryKey: forumKeys.thread(id),
    queryFn: () => api.get<ThreadDetail>(`/forum/threads/${id}`),
    enabled: !!id,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateThreadDto) => api.post<ForumThread>("/forum/threads", dto),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({
        queryKey: forumKeys.threads(thread.categoryId),
      });
      queryClient.invalidateQueries({
        queryKey: forumKeys.categories(thread.categoryId),
      });
    },
  });
}

export function useUpdateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateThreadDto }) =>
      api.patch<ForumThread>(`/forum/threads/${id}`, dto),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: forumKeys.thread(thread.id) });
      queryClient.invalidateQueries({
        queryKey: forumKeys.threads(thread.categoryId),
      });
    },
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/forum/threads/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumKeys.all });
    },
  });
}

// ============ Reply Hooks ============

export function useCreateReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, dto }: { threadId: string; dto: CreateReplyDto }) =>
      api.post<ForumReply>(`/forum/threads/${threadId}/replies`, dto),
    onSuccess: (reply) => {
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(reply.threadId),
      });
    },
  });
}

export function useUpdateReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string; threadId: string }) =>
      api.patch<ForumReply>(`/forum/replies/${id}`, { content }),
    onSuccess: (reply) => {
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(reply.threadId),
      });
    },
  });
}

export function useDeleteReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, threadId }: { id: string; threadId: string }) => {
      await api.delete(`/forum/replies/${id}`);
      return { id, threadId };
    },
    onSuccess: ({ threadId }) => {
      queryClient.invalidateQueries({ queryKey: forumKeys.thread(threadId) });
    },
  });
}

export function useMarkAsSolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, replyId }: { threadId: string; replyId: string }) =>
      api.post<ForumReply>(`/forum/threads/${threadId}/replies/${replyId}/solution`),
    onSuccess: (reply) => {
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(reply.threadId),
      });
    },
  });
}
