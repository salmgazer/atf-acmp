"use client";

import { useState } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  useAuditLogs,
  useAuditLogStats,
  useAuditEntityTypes,
  AuditAction,
  AuditLog,
  getActionColor,
  getActionLabel,
} from "@/lib/api/hooks/use-audit-logs";
import {
  Search,
  Activity,
  Clock,
  User,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Eye,
  Calendar,
  BarChart3,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// Stats card component
function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl bg-card p-5 border border-border">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Action badge component
function ActionBadge({ action }: { action: AuditAction }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionColor(
        action
      )}`}
    >
      {getActionLabel(action)}
    </span>
  );
}

// Audit log detail modal
function AuditLogDetail({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl bg-card border border-border shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-lg font-semibold text-foreground">Audit Log Details</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Action</p>
              <ActionBadge action={log.action} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timestamp</p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(log.createdAt), "PPpp")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actor</p>
              <p className="text-sm font-medium text-foreground">
                {log.actor?.firstName && log.actor?.lastName
                  ? `${log.actor.firstName} ${log.actor.lastName}`
                  : log.actorEmail || "System"}
              </p>
              {log.actorEmail && (
                <p className="text-xs text-muted-foreground">{log.actorEmail}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Entity</p>
              <p className="text-sm font-medium text-foreground">
                {log.entityType}
                {log.entityName && `: ${log.entityName}`}
              </p>
              {log.entityId && (
                <code className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {log.entityId}
                </code>
              )}
            </div>
          </div>

          {/* Description */}
          {log.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground bg-muted rounded-lg p-3">
                {log.description}
              </p>
            </div>
          )}

          {/* Changes */}
          {log.changes && Object.keys(log.changes).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Changes</p>
              <div className="bg-muted rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">
                        Field
                      </th>
                      <th className="text-left p-2 font-medium text-muted-foreground">
                        From
                      </th>
                      <th className="text-left p-2 font-medium text-muted-foreground">
                        To
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(log.changes).map(([field, change]) => (
                      <tr key={field} className="border-b border-border last:border-0">
                        <td className="p-2 font-medium text-foreground">{field}</td>
                        <td className="p-2 text-red-600 dark:text-red-400">
                          <code className="text-xs">
                            {JSON.stringify(change.from, null, 2) ?? "null"}
                          </code>
                        </td>
                        <td className="p-2 text-green-600 dark:text-green-400">
                          <code className="text-xs">
                            {JSON.stringify(change.to, null, 2) ?? "null"}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Before/After JSON */}
          {(log.before || log.after) && !log.changes && (
            <div className="grid grid-cols-2 gap-4">
              {log.before && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Before</p>
                  <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-48">
                    {JSON.stringify(log.before, null, 2)}
                  </pre>
                </div>
              )}
              {log.after && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">After</p>
                  <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-48">
                    {JSON.stringify(log.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* IP & User Agent */}
          {(log.ipAddress || log.userAgent) && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">Request Info</p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {log.ipAddress && (
                  <div>
                    <span className="text-muted-foreground">IP Address: </span>
                    <span className="text-foreground">{log.ipAddress}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Audit log row component
function AuditLogRow({
  log,
  onView,
}: {
  log: AuditLog;
  onView: (log: AuditLog) => void;
}) {
  const actorName =
    log.actor?.firstName && log.actor?.lastName
      ? `${log.actor.firstName} ${log.actor.lastName}`
      : log.actorEmail || "System";

  return (
    <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{actorName}</p>
            {log.actorEmail && actorName !== log.actorEmail && (
              <p className="text-xs text-muted-foreground">{log.actorEmail}</p>
            )}
          </div>
        </div>
      </td>
      <td className="p-4">
        <ActionBadge action={log.action} />
      </td>
      <td className="p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{log.entityType}</p>
          {log.entityName && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {log.entityName}
            </p>
          )}
        </div>
      </td>
      <td className="p-4">
        <p className="text-sm text-muted-foreground truncate max-w-[300px]">
          {log.description || "—"}
        </p>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span title={format(new Date(log.createdAt), "PPpp")}>
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </span>
        </div>
      </td>
      <td className="p-4">
        <button
          onClick={() => onView(log)}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function AuditLogsContent() {
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState<AuditAction | "">("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const limit = 20;

  const { data: logsData, isLoading } = useAuditLogs({
    search: search || undefined,
    action: selectedAction || undefined,
    entityType: selectedEntityType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit,
  });

  const { data: stats } = useAuditLogStats();
  const { data: entityTypes } = useAuditEntityTypes();

  const clearFilters = () => {
    setSearch("");
    setSelectedAction("");
    setSelectedEntityType("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasFilters =
    search || selectedAction || selectedEntityType || startDate || endDate;

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track all system activities and changes
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Logs"
              value={stats.totalLogs.toLocaleString()}
              icon={Activity}
            />
            <StatCard
              label="Today's Activity"
              value={stats.todayLogs.toLocaleString()}
              icon={Clock}
            />
            <StatCard
              label="Entity Types"
              value={Object.keys(stats.entityTypeBreakdown).length}
              icon={FileText}
            />
            <StatCard
              label="Active Users (30d)"
              value={stats.topActors.length}
              icon={User}
            />
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by description, entity, or actor..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                showFilters || hasFilters
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  !
                </span>
              )}
            </button>

            {/* Clear Filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4 rounded-xl bg-muted/50 border border-border">
              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Action
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value as AuditAction | "");
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border bg-card py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Actions</option>
                  {Object.values(AuditAction).map((action) => (
                    <option key={action} value={action}>
                      {getActionLabel(action)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Entity Type
                </label>
                <select
                  value={selectedEntityType}
                  onChange={(e) => {
                    setSelectedEntityType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border bg-card py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Types</option>
                  {entityTypes?.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border bg-card py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border bg-card py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Logs Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logsData && logsData.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                        Actor
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                        Action
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                        Entity
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                        Time
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData.data.map((log) => (
                      <AuditLogRow
                        key={log.id}
                        log={log}
                        onView={setSelectedLog}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, logsData.total)} of{" "}
                  {logsData.total.toLocaleString()} logs
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {logsData.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(logsData.totalPages, p + 1))
                    }
                    disabled={page >= logsData.totalPages}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-foreground">No audit logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasFilters
                  ? "Try adjusting your filters"
                  : "System activities will appear here"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <AuditLogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </StaffLayout>
  );
}

export default function AuditLogsPage() {
  return (
    <ProtectedRoute portal="staff">
      <AuditLogsContent />
    </ProtectedRoute>
  );
}
