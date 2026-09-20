"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  useBriefs,
  useBriefStatistics,
  type Brief,
  type BriefStatus,
  type BriefQueryParams,
} from "@/lib/api/hooks/use-briefs";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
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

// Priority score badge styling based on score range
function getPriorityBadgeStyle(score?: number | null): { bgClass: string; textClass: string; label: string } {
  if (score === undefined || score === null) {
    return { bgClass: "bg-muted", textClass: "text-muted-foreground", label: "—" };
  }
  if (score >= 140) {
    return { bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", label: String(score) };
  }
  if (score >= 100) {
    return { bgClass: "bg-blue-500/15", textClass: "text-blue-600", label: String(score) };
  }
  if (score >= 50) {
    return { bgClass: "bg-amber-500/15", textClass: "text-amber-600", label: String(score) };
  }
  return { bgClass: "bg-red-500/15", textClass: "text-red-600", label: String(score) };
}

function BriefRow({ brief }: { brief: Brief }) {
  const config = statusConfig[brief.status];
  const StatusIcon = config.icon;
  const isReviewable = ["submitted", "in_review"].includes(brief.status);
  const priorityStyle = getPriorityBadgeStyle(brief.priorityScore);

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
                <Video className="h-4 w-4 shrink-0 text-primary" aria-label="Has video pitch" />
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
        <div className="flex flex-col gap-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyle.bgClass} ${priorityStyle.textClass}`}>
            <TrendingUp className="h-3 w-3" />
            {priorityStyle.label}
          </span>
          {brief.scoreOverride && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-500/15 text-orange-600" title={brief.scoreOverride}>
              <AlertCircle className="h-3 w-3" />
              {brief.scoreOverride.replace('Score override: ', '')}
            </span>
          )}
        </div>
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
  // Get global cohort from store (set by sidebar)
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);
  
  // Local cohort filter - initialized from global but can be overridden
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BriefStatus | "all" | "pending">("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<BriefQueryParams["sortBy"]>("createdAt");
  const [sortOrder, setSortOrder] = useState<BriefQueryParams["sortOrder"]>("desc");
  const [isExporting, setIsExporting] = useState(false);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  // Initialize local cohort from global when component mounts (if not yet set locally)
  useEffect(() => {
    if (globalCohortId && !hasInitialized) {
      setSelectedCohortId(null); // null means "use global"
      setHasInitialized(true);
    }
  }, [globalCohortId, hasInitialized]);

  // Use local cohort if explicitly set, otherwise fall back to global
  const effectiveCohortId = selectedCohortId ?? globalCohortId ?? undefined;
  
  // Find the selected cohort name for display
  const selectedCohort = cohorts.find(c => c.id === effectiveCohortId);

  const apiStatus = statusFilter === "all" ? undefined : 
                    statusFilter === "pending" ? undefined : statusFilter;
  
  const { data: briefsData, isLoading } = useBriefs({
    cohortId: effectiveCohortId,
    status: apiStatus,
    search: search || undefined,
    limit: 100,
    sortBy,
    sortOrder,
  });
  
  const { data: stats } = useBriefStatistics(effectiveCohortId);

  let briefs = briefsData?.data || [];
  if (statusFilter === "pending") {
    briefs = briefs.filter(b => ["submitted", "in_review"].includes(b.status));
  }

  const pendingCount = (stats?.submitted || 0) + (stats?.inReview || 0);
  const hasActiveFilters = statusFilter !== "all" || (selectedCohortId !== null && selectedCohortId !== globalCohortId);

  // Toggle sort order or change sort field
  const handleSort = (field: BriefQueryParams["sortBy"]) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Get sort icon for a column
  const getSortIcon = (field: BriefQueryParams["sortBy"]) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortOrder === "desc" 
      ? <ArrowDown className="h-3 w-3 ml-1" />
      : <ArrowUp className="h-3 w-3 ml-1" />;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (effectiveCohortId) params.set("cohortId", effectiveCohortId);
      if (apiStatus) params.set("status", apiStatus);
      if (search) params.set("search", search);
      params.set("limit", "10000");

      const response = await api.get<{ data: Brief[] }>(`/briefs?${params.toString()}`);
      let allBriefs = response.data;

      // Apply pending filter if needed
      if (statusFilter === "pending") {
        allBriefs = allBriefs.filter(b => ["submitted", "in_review"].includes(b.status));
      }

      if (allBriefs.length === 0) {
        toast.error("No briefs to export");
        return;
      }

      const headers = [
        "Title",
        "Organization",
        "Vertical",
        "Status",
        "Priority Score",
        "Max Teams",
        "Teams Count",
        "Submitted At",
        "Approved At",
        "Created At",
      ];

      const rows = allBriefs.map((b) => [
        b.title,
        b.organization?.name || "",
        b.vertical?.name || "",
        b.status,
        b.priorityScore !== null && b.priorityScore !== undefined ? String(b.priorityScore) : "",
        String(b.maxTeams),
        String(b.teamsCount),
        b.submittedAt ? formatDistanceToNow(new Date(b.submittedAt), { addSuffix: true }) : "",
        b.approvedAt ? format(new Date(b.approvedAt), "yyyy-MM-dd HH:mm:ss") : "",
        format(new Date(b.createdAt), "yyyy-MM-dd HH:mm:ss"),
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cohortName = cohorts.find((c) => c.id === effectiveCohortId)?.name || "all";
      const timestamp = format(new Date(), "yyyy-MM-dd");
      link.download = `briefs_${cohortName.replace(/\s+/g, "_")}_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allBriefs.length} briefs`);
    } catch (error: any) {
      toast.error(error.message || "Failed to export briefs");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Brief Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage organization brief submissions
            {selectedCohort && ` for ${selectedCohort.name}`}
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
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
        </div>

        {/* Collapsible Filter Row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
            <div className="flex items-center gap-2">
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
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Cohort:</span>
              <Select 
                value={selectedCohortId ?? globalCohortId ?? ""} 
                onValueChange={(v) => setSelectedCohortId(v || null)}
              >
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setSelectedCohortId(null);
                }}
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
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort("priority")}
                  >
                    <span className="inline-flex items-center">
                      Priority
                      {getSortIcon("priority")}
                    </span>
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort("createdAt")}
                  >
                    <span className="inline-flex items-center">
                      Date
                      {getSortIcon("createdAt")}
                    </span>
                  </th>
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
