"use client";

import { useState } from "react";
import Link from "next/link";
import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  useBriefs,
  useDeleteBrief,
  type Brief,
  type BriefStatus,
  type BriefQueryParams,
} from "@/lib/api/hooks/use-briefs";
import { useCurrentOrganization } from "@/lib/api/hooks/use-organizations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  SlidersHorizontal,
  X,
  Plus,
  Pencil,
  MoreHorizontal,
  Trash2,
  Users,
  Video,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<BriefStatus, { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", bgClass: "bg-zinc-500/15", textClass: "text-zinc-600", icon: Clock },
  submitted: { label: "Submitted", bgClass: "bg-blue-500/15", textClass: "text-blue-600", icon: Clock },
  in_review: { label: "In Review", bgClass: "bg-purple-500/15", textClass: "text-purple-600", icon: Clock },
  approved: { label: "Approved", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejected", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
  revision_requested: { label: "Needs Revision", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: AlertCircle },
};

const statusTabs: { value: BriefStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "revision_requested", label: "Needs Revision" },
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

function BriefRow({
  brief,
  onEdit,
  onDelete,
}: {
  brief: Brief;
  onEdit: (brief: Brief) => void;
  onDelete: (brief: Brief) => void;
}) {
  const config = statusConfig[brief.status];
  const StatusIcon = config.icon;
  const priorityStyle = getPriorityBadgeStyle(brief.priorityScore);

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/org/briefs/${brief.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {brief.title}
              </Link>
              {brief.videoUrl && (
                <Video className="h-4 w-4 shrink-0 text-primary" aria-label="Has video pitch" />
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">
              {brief.description}
            </p>
          </div>
        </div>
      </td>
      <td className="p-4">
        {brief.vertical ? (
          <span className="text-sm text-muted-foreground">{brief.vertical.name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyle.bgClass} ${priorityStyle.textClass}`}>
          <TrendingUp className="h-3 w-3" />
          {priorityStyle.label}
        </span>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{brief.teamsCount}/{brief.maxTeams}</span>
        </div>
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(brief.updatedAt), "MMM d, yyyy")}
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/org/briefs/${brief.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            {(brief.status === "draft" || brief.status === "revision_requested") && (
              <DropdownMenuItem asChild>
                <Link href={`/org/briefs/${brief.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
            )}
            {brief.status === "draft" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(brief)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function BriefsContent() {
  const { data: currentOrg, isLoading: isOrgLoading } = useCurrentOrganization();
  // Get cohort directly from the organization response
  const cohort = currentOrg?.cohort;
  const cohortId = currentOrg?.cohortId;
  
  const [statusFilter, setStatusFilter] = useState<BriefStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [briefToDelete, setBriefToDelete] = useState<Brief | null>(null);
  const [sortBy, setSortBy] = useState<BriefQueryParams["sortBy"]>("updatedAt");
  const [sortOrder, setSortOrder] = useState<BriefQueryParams["sortOrder"]>("desc");

  const { data: briefsData, isLoading } = useBriefs({
    organizationId: currentOrg?.id,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    limit: 100,
    sortBy,
    sortOrder,
  });

  // Also fetch all briefs without status filter to calculate org-specific stats
  const { data: allBriefsData } = useBriefs({
    organizationId: currentOrg?.id,
    limit: 1000, // Get all briefs for accurate stats
  });

  const deleteMutation = useDeleteBrief();

  const briefs = briefsData?.data || [];
  const allBriefs = allBriefsData?.data || [];
  
  // Calculate org-specific stats from the briefs list
  const stats = {
    total: allBriefs.length,
    draft: allBriefs.filter(b => b.status === "draft").length,
    submitted: allBriefs.filter(b => b.status === "submitted").length,
    inReview: allBriefs.filter(b => b.status === "in_review").length,
    approved: allBriefs.filter(b => b.status === "approved").length,
    rejected: allBriefs.filter(b => b.status === "rejected").length,
    revisionRequested: allBriefs.filter(b => b.status === "revision_requested").length,
  };
  
  const hasActiveFilters = statusFilter !== "all";
  
  // hasCohort is true when org has a cohort assigned
  const hasCohort = !!cohort;

  const handleDeleteClick = (brief: Brief) => {
    setBriefToDelete(brief);
  };

  const handleDeleteConfirm = async () => {
    if (!briefToDelete) return;
    await deleteMutation.mutateAsync(briefToDelete.id);
    setBriefToDelete(null);
  };

  // Placeholder edit handler - navigates to edit page
  const handleEditClick = (brief: Brief) => {
    window.location.href = `/org/briefs/${brief.id}/edit`;
  };

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

  if (isOrgLoading) {
    return (
      <OrganizationLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Briefs</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage your innovation challenge briefs
            </p>
          </div>
        </div>

        {/* No Cohort Warning */}
        {!hasCohort && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">No cohort assigned</span>
            </div>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Brief creation is available only when your organization is assigned to a cohort.
              Please contact the program administrators.
            </p>
          </div>
        )}

        {/* Cohort Info Banner */}
        {hasCohort && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Active Challenge</p>
                <p className="text-lg font-semibold">{cohort.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {hasCohort && (
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Total Briefs</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.total || 0}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Draft</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-600">
                {stats?.draft || 0}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Pending Review</div>
              <div className="mt-1 text-2xl font-semibold text-blue-600">
                {(stats?.submitted || 0) + (stats?.inReview || 0)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">
                {stats?.approved || 0}
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Toggle */}
        {hasCohort && (
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
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
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
            <div className="ml-auto">
              <Button asChild className="gap-2">
                <Link href="/org/briefs/new">
                  <Plus className="h-4 w-4" />
                  New Brief
                </Link>
              </Button>
            </div>
          </div>
        )}

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
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-card text-muted-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
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

        {/* Table */}
        {hasCohort && (
          <>
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
                  {statusFilter !== "all"
                    ? `You don't have any briefs with status "${statusConfig[statusFilter]?.label}".`
                    : "Create your first brief to get started."}
                </p>
                {statusFilter === "all" && (
                  <Button asChild className="mt-4">
                    <Link href="/org/briefs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Brief
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Brief</th>
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
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Teams</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th 
                        className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("updatedAt")}
                      >
                        <span className="inline-flex items-center">
                          Updated
                          {getSortIcon("updatedAt")}
                        </span>
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {briefs.map((brief) => (
                      <BriefRow
                        key={brief.id}
                        brief={brief}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!briefToDelete} onOpenChange={(open) => !open && setBriefToDelete(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Brief</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete &quot;{briefToDelete?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBriefToDelete(null)} className="border-border">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrganizationLayout>
  );
}

export default function OrganizationBriefsPage() {
  return (
    <ProtectedRoute portal="organization">
      <BriefsContent />
    </ProtectedRoute>
  );
}
