"use client";

import { useState } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  useTeams,
  useTeamStatistics,
  type Team,
  type TeamStatus,
} from "@/lib/api/hooks/use-teams";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import {
  Search,
  Users,
  Clock,
  CheckCircle,
  Send,
  Award,
  XCircle,
  Eye,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<
  TeamStatus,
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  forming: { label: "Forming", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: Clock },
  active: { label: "Active", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  submitted: { label: "Submitted", bgClass: "bg-blue-500/15", textClass: "text-blue-600", icon: Send },
  evaluated: { label: "Evaluated", bgClass: "bg-purple-500/15", textClass: "text-purple-600", icon: Award },
  disqualified: { label: "Disqualified", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
};

const statusTabs: { value: TeamStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "forming", label: "Forming" },
  { value: "active", label: "Active" },
  { value: "submitted", label: "Submitted" },
  { value: "evaluated", label: "Evaluated" },
  { value: "disqualified", label: "Disqualified" },
];

function TeamRow({ team }: { team: Team }) {
  const config = statusConfig[team.status];
  const StatusIcon = config.icon;

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <td className="p-4">
        <div>
          <Link
            href={`/portal/teams/${team.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {team.name}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            Code: {team.inviteCode}
          </p>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{team.members?.length || 0}</span>
        </div>
      </td>
      <td className="p-4">
        {team.brief ? (
          <div className="max-w-[200px]">
            <p className="text-sm font-medium text-foreground truncate">{team.brief.title}</p>
            {team.brief.organization && (
              <p className="text-xs text-muted-foreground truncate">
                {team.brief.organization.name}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Not assigned</span>
        )}
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(team.createdAt), "MMM d, yyyy")}
      </td>
      <td className="p-4">
        <Link
          href={`/portal/teams/${team.id}`}
          className="p-2 rounded-lg hover:bg-muted inline-flex text-muted-foreground hover:text-muted-foreground"
        >
          <Eye className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function TeamsContent() {
  const [statusFilter, setStatusFilter] = useState<TeamStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [briefFilter, setBriefFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  const { data: teamsData, isLoading } = useTeams({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    cohortId: selectedCohortId || undefined,
    hasbrief: briefFilter === "all" ? undefined : briefFilter === "with",
    page,
    limit: 20,
  });
  const { data: stats } = useTeamStatistics(selectedCohortId || undefined);

  const teams = teamsData?.data || [];
  const totalPages = teamsData?.totalPages || 1;

  const activeFilterCount = [
    statusFilter !== "all",
    selectedCohortId !== "",
    briefFilter !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setStatusFilter("all");
    setSelectedCohortId("");
    setBriefFilter("all");
    setPage(1);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Manage teams, assignments, and progress
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.total || 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">
              {stats?.active || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Forming</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">
              {stats?.forming || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">With Brief</div>
            <div className="mt-1 text-2xl font-semibold text-blue-600">
              {stats?.withBrief || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Avg Members</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.averageMembers || 0}</div>
          </div>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Filter Row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <div className="flex flex-wrap gap-1">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setStatusFilter(tab.value);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === tab.value
                        ? "bg-zinc-900 text-white"
                        : "bg-card text-muted-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Cohort:</span>
              <select
                value={selectedCohortId || "all"}
                onChange={(e) => {
                  setSelectedCohortId(e.target.value === "all" ? "" : e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
              >
                <option value="all">All Cohorts</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Brief:</span>
              <select
                value={briefFilter}
                onChange={(e) => {
                  setBriefFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
              >
                <option value="all">All Teams</option>
                <option value="with">With Brief</option>
                <option value="without">Without Brief</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Table */}
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
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "No teams match your search criteria."
                : "Teams will appear here once participants form them."}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Team</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Brief</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Created</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <TeamRow key={team.id} team={team} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({teamsData?.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StaffLayout>
  );
}

export default function TeamsPage() {
  return (
    <ProtectedRoute portal="staff">
      <TeamsContent />
    </ProtectedRoute>
  );
}
