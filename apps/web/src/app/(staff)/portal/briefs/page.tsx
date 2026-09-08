"use client";

import { useState } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  useBriefs,
  useBriefStatistics,
  type Brief,
  type BriefStatus,
} from "@/lib/api/hooks/use-briefs";
import { useActiveCohort } from "@/lib/api/hooks/use-cohorts";
import {
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  Building2,
  SlidersHorizontal,
  X,
  Video,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const statusConfig: Record<BriefStatus, { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", bgClass: "bg-muted", textClass: "text-muted-foreground", icon: Clock },
  submitted: { label: "Submitted", bgClass: "bg-blue-500/15", textClass: "text-blue-600", icon: Clock },
  in_review: { label: "In Review", bgClass: "bg-purple-500/15", textClass: "text-purple-600", icon: Clock },
  approved: { label: "Approved", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejected", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
  revision_requested: { label: "Revision Requested", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: AlertCircle },
};

const statusTabs: { value: BriefStatus | "all" | "pending"; label: string }[] = [
  { value: "all", label: "All Briefs" },
  { value: "pending", label: "Pending Review" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revision_requested", label: "Revision Requested" },
];

function BriefRow({ brief }: { brief: Brief }) {
  const config = statusConfig[brief.status];
  const StatusIcon = config.icon;
  const isReviewable = ["submitted", "in_review"].includes(brief.status);

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <td className="p-4 max-w-[280px]">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/portal/briefs/${brief.id}`}
                className="font-medium text-foreground hover:underline line-clamp-1"
              >
                {brief.title}
              </Link>
              {brief.videoUrl && (
                <Video className="h-4 w-4 shrink-0 text-primary" title="Has video pitch" />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
              {brief.description?.replace(/<[^>]*>/g, '').slice(0, 60)}...
            </p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm truncate max-w-[140px]">{brief.organization?.name || "Unknown"}</span>
        </div>
      </td>
      <td className="p-4">
        {brief.vertical ? (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            {brief.vertical.name}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
        {brief.submittedAt
          ? format(new Date(brief.submittedAt), "MMM d, yyyy")
          : formatDistanceToNow(new Date(brief.createdAt), { addSuffix: true })}
      </td>
      <td className="p-4">
        <Link
          href={`/portal/briefs/${brief.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted"
        >
          <Eye className="h-4 w-4" />
          {isReviewable ? "Review" : "View"}
        </Link>
      </td>
    </tr>
  );
}

function BriefsReviewContent() {
  const { data: activeCohort } = useActiveCohort();
  const [statusFilter, setStatusFilter] = useState<BriefStatus | "all" | "pending">("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const apiStatus = statusFilter === "all" ? undefined : 
                    statusFilter === "pending" ? undefined : statusFilter;
  
  const { data: briefsData, isLoading } = useBriefs({
    cohortId: activeCohort?.id,
    status: apiStatus,
    search: search || undefined,
    limit: 100,
  });
  
  const { data: stats } = useBriefStatistics(activeCohort?.id);

  let briefs = briefsData?.data || [];
  if (statusFilter === "pending") {
    briefs = briefs.filter(b => ["submitted", "in_review"].includes(b.status));
  }

  const pendingCount = (stats?.submitted || 0) + (stats?.inReview || 0);
  const hasActiveFilters = statusFilter !== "all";

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Brief Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage organization brief submissions
            {activeCohort && ` for ${activeCohort.name}`}
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.total || 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Pending Review</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">
              {pendingCount}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Approved</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">
              {stats?.approved || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Rejected</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">
              {stats?.rejected || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Revision Req.</div>
            <div className="mt-1 text-2xl font-semibold text-orange-600">
              {stats?.revisionRequested || 0}
            </div>
          </div>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search briefs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-11 pr-4 text-sm bg-transparent border border-border rounded-full focus:border-zinc-400 focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showFilters || hasActiveFilters
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex items-center justify-center w-5 h-5 text-xs rounded-full bg-card text-foreground">
                1
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Filter Row */}
        {showFilters && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === tab.value
                      ? "bg-zinc-900 text-white"
                      : "bg-card text-muted-foreground border border-border hover:bg-muted"
                  }`}
                >
                  {tab.label}
                  {tab.value === "pending" && pendingCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-card/20">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Briefs Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : briefs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">No briefs found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusFilter === "pending"
                ? "No briefs are waiting for review."
                : "No briefs match your current filters."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Brief</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Organization</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Vertical</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {briefs.map((brief) => (
                  <BriefRow key={brief.id} brief={brief} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StaffLayout>
  );
}

export default function BriefsReviewPage() {
  return (
    <ProtectedRoute portal="staff">
      <BriefsReviewContent />
    </ProtectedRoute>
  );
}
