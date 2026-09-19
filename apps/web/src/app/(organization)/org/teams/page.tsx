"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Badge } from "@/components/ui/badge";
import {
  useTeams,
  type Team,
  type TeamStatus,
} from "@/lib/api/hooks/use-teams";
import { useBriefs } from "@/lib/api/hooks/use-briefs";
import { useCurrentOrganization } from "@/lib/api/hooks/use-organizations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Users,
  Loader2,
  SlidersHorizontal,
  X,
  Award,
  GitBranch,
  FileText,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<TeamStatus, { label: string; bgClass: string; textClass: string }> = {
  forming: { label: "Forming", bgClass: "bg-zinc-500/15", textClass: "text-zinc-600" },
  active: { label: "Active", bgClass: "bg-blue-500/15", textClass: "text-blue-600" },
  submitted: { label: "Submitted", bgClass: "bg-purple-500/15", textClass: "text-purple-600" },
  evaluated: { label: "Evaluated", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600" },
  disqualified: { label: "Disqualified", bgClass: "bg-red-500/15", textClass: "text-red-600" },
};

const statusOptions: { value: TeamStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "forming", label: "Forming" },
  { value: "active", label: "Active" },
  { value: "submitted", label: "Submitted" },
  { value: "evaluated", label: "Evaluated" },
];

function TeamRow({ team }: { team: Team }) {
  const config = statusConfig[team.status];

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <td className="p-4">
        <div>
          <div className="font-medium text-foreground">{team.name}</div>
          {team.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
              {team.description}
            </p>
          )}
        </div>
      </td>
      <td className="p-4">
        {team.brief ? (
          <Link
            href={`/org/briefs/${team.brief.id}`}
            className="text-sm text-foreground hover:underline"
          >
            {team.brief.title}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{team.memberCount}</span>
        </div>
      </td>
      <td className="p-4">
        {team.mentor ? (
          <div className="flex items-center gap-1.5 text-sm">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground">
              {team.mentor.firstName} {team.mentor.lastName}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          {config.label}
        </span>
      </td>
      <td className="p-4">
        {team.githubRepoUrl ? (
          <a
            href={team.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Repo</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(team.updatedAt), { addSuffix: true })}
      </td>
    </tr>
  );
}

function TeamsContent() {
  const { data: currentOrg, isLoading: isOrgLoading } = useCurrentOrganization();
  const cohort = currentOrg?.cohort;
  const searchParams = useSearchParams();
  const initialBriefId = searchParams.get("briefId");

  const [statusFilter, setStatusFilter] = useState<TeamStatus | "all">("all");
  const [briefFilter, setBriefFilter] = useState<string>(initialBriefId || "all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(!!initialBriefId);

  // Fetch all briefs for this organization (for the filter dropdown)
  const { data: briefsData } = useBriefs({
    organizationId: currentOrg?.id,
    status: "approved",
    limit: 100,
  });

  // Fetch teams for this organization
  const { data: teamsData, isLoading } = useTeams({
    organizationId: currentOrg?.id,
    status: statusFilter === "all" ? undefined : statusFilter,
    briefId: briefFilter === "all" ? undefined : briefFilter,
    search: search || undefined,
    limit: 100,
  });

  const briefs = briefsData?.data || [];
  const teams = teamsData?.data || [];

  // Calculate stats
  const stats = useMemo(() => {
    const allTeams = teams;
    return {
      total: allTeams.length,
      forming: allTeams.filter(t => t.status === "forming").length,
      active: allTeams.filter(t => t.status === "active").length,
      submitted: allTeams.filter(t => t.status === "submitted").length,
      evaluated: allTeams.filter(t => t.status === "evaluated").length,
    };
  }, [teams]);

  const hasActiveFilters = statusFilter !== "all" || briefFilter !== "all";
  const hasCohort = !!cohort;

  const clearFilters = () => {
    setStatusFilter("all");
    setBriefFilter("all");
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
            <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
            <p className="text-sm text-muted-foreground">
              Track teams working on your organization's briefs
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
              Team data is available only when your organization is assigned to a cohort.
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
          <div className="grid gap-4 sm:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Total Teams</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Forming</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-600">{stats.forming}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Active</div>
              <div className="mt-1 text-2xl font-semibold text-blue-600">{stats.active}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Submitted</div>
              <div className="mt-1 text-2xl font-semibold text-purple-600">{stats.submitted}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Evaluated</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">{stats.evaluated}</div>
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
                placeholder="Search teams..."
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
                  {(statusFilter !== "all" ? 1 : 0) + (briefFilter !== "all" ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Collapsible Filter Row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TeamStatus | "all")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Brief:</span>
              <Select value={briefFilter} onValueChange={setBriefFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Briefs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Briefs</SelectItem>
                  {briefs.map((brief) => (
                    <SelectItem key={brief.id} value={brief.id}>
                      {brief.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
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
            ) : teams.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-foreground">No teams found</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  {hasActiveFilters
                    ? "No teams match your current filters. Try adjusting your search criteria."
                    : "No teams have been assigned to your briefs yet. Teams will appear here once the matching process is complete."}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Team</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Brief</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mentor</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Repository</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <TeamRow key={team.id} team={team} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </OrganizationLayout>
  );
}

export default function OrganizationTeamsPage() {
  return (
    <ProtectedRoute portal="organization">
      <TeamsContent />
    </ProtectedRoute>
  );
}
