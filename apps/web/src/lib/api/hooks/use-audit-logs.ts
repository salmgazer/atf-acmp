import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

// Types
export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  PASSWORD_CHANGE = "password_change",
  STATUS_CHANGE = "status_change",
  ASSIGNMENT = "assignment",
  BULK_IMPORT = "bulk_import",
  BULK_ACTION = "bulk_action",
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  actor?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityName?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Record<string, { from: any; to: any }>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AuditLogQueryParams {
  actorId?: string;
  actorEmail?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  actionBreakdown: Record<string, number>;
  entityTypeBreakdown: Record<string, number>;
  topActors: { actorId: string; actorEmail: string; count: number }[];
}

// Query keys
export const auditLogKeys = {
  all: ["audit-logs"] as const,
  lists: () => [...auditLogKeys.all, "list"] as const,
  list: (params: AuditLogQueryParams) => [...auditLogKeys.lists(), params] as const,
  detail: (id: string) => [...auditLogKeys.all, "detail", id] as const,
  entity: (entityType: string, entityId: string) =>
    [...auditLogKeys.all, "entity", entityType, entityId] as const,
  actor: (actorId: string) => [...auditLogKeys.all, "actor", actorId] as const,
  stats: () => [...auditLogKeys.all, "stats"] as const,
  entityTypes: () => [...auditLogKeys.all, "entity-types"] as const,
};

// API functions
async function fetchAuditLogs(params: AuditLogQueryParams): Promise<AuditLogResponse> {
  const searchParams = new URLSearchParams();

  if (params.actorId) searchParams.append("actorId", params.actorId);
  if (params.actorEmail) searchParams.append("actorEmail", params.actorEmail);
  if (params.action) searchParams.append("action", params.action);
  if (params.entityType) searchParams.append("entityType", params.entityType);
  if (params.entityId) searchParams.append("entityId", params.entityId);
  if (params.search) searchParams.append("search", params.search);
  if (params.startDate) searchParams.append("startDate", params.startDate);
  if (params.endDate) searchParams.append("endDate", params.endDate);
  if (params.page) searchParams.append("page", params.page.toString());
  if (params.limit) searchParams.append("limit", params.limit.toString());

  return api.get<AuditLogResponse>(
    `/admin/audit-logs?${searchParams.toString()}`
  );
}

async function fetchAuditLog(id: string): Promise<AuditLog> {
  return api.get<AuditLog>(`/admin/audit-logs/${id}`);
}

async function fetchAuditLogsByEntity(
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  return api.get<AuditLog[]>(
    `/admin/audit-logs/entity/${entityType}/${entityId}`
  );
}

async function fetchAuditLogsByActor(actorId: string): Promise<AuditLog[]> {
  return api.get<AuditLog[]>(`/admin/audit-logs/actor/${actorId}`);
}

async function fetchAuditLogStats(): Promise<AuditLogStats> {
  return api.get<AuditLogStats>("/admin/audit-logs/stats");
}

async function fetchEntityTypes(): Promise<string[]> {
  return api.get<string[]>("/admin/audit-logs/entity-types");
}

// Hooks
export function useAuditLogs(params: AuditLogQueryParams = {}) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () => fetchAuditLogs(params),
  });
}

export function useAuditLog(id: string) {
  return useQuery({
    queryKey: auditLogKeys.detail(id),
    queryFn: () => fetchAuditLog(id),
    enabled: !!id,
  });
}

export function useAuditLogsByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: auditLogKeys.entity(entityType, entityId),
    queryFn: () => fetchAuditLogsByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useAuditLogsByActor(actorId: string) {
  return useQuery({
    queryKey: auditLogKeys.actor(actorId),
    queryFn: () => fetchAuditLogsByActor(actorId),
    enabled: !!actorId,
  });
}

export function useAuditLogStats() {
  return useQuery({
    queryKey: auditLogKeys.stats(),
    queryFn: fetchAuditLogStats,
  });
}

export function useAuditEntityTypes() {
  return useQuery({
    queryKey: auditLogKeys.entityTypes(),
    queryFn: fetchEntityTypes,
  });
}

// Helper functions
export function getActionColor(action: AuditAction): string {
  const colors: Record<AuditAction, string> = {
    [AuditAction.CREATE]: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    [AuditAction.UPDATE]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    [AuditAction.DELETE]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    [AuditAction.LOGIN]: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    [AuditAction.LOGOUT]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    [AuditAction.PASSWORD_CHANGE]: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    [AuditAction.STATUS_CHANGE]: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    [AuditAction.ASSIGNMENT]: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    [AuditAction.BULK_IMPORT]: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    [AuditAction.BULK_ACTION]: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  };
  return colors[action] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    [AuditAction.CREATE]: "Created",
    [AuditAction.UPDATE]: "Updated",
    [AuditAction.DELETE]: "Deleted",
    [AuditAction.LOGIN]: "Logged In",
    [AuditAction.LOGOUT]: "Logged Out",
    [AuditAction.PASSWORD_CHANGE]: "Password Changed",
    [AuditAction.STATUS_CHANGE]: "Status Changed",
    [AuditAction.ASSIGNMENT]: "Assigned",
    [AuditAction.BULK_IMPORT]: "Bulk Import",
    [AuditAction.BULK_ACTION]: "Bulk Action",
  };
  return labels[action] || action;
}
