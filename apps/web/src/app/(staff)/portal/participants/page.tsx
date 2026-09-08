"use client";

import { useState } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  useParticipants,
  useParticipantStatistics,
  type Participant,
  type ParticipantStatus,
} from "@/lib/api/hooks/use-participants";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { TablePagination, type PageSize } from "@/components/ui/table-pagination";
import {
  Search,
  Users,
  Clock,
  CheckCircle,
  UserCheck,
  UserX,
  Eye,
  Loader2,
  Upload,
  MapPin,
  GraduationCap,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<
  ParticipantStatus,
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  imported: { label: "Imported", bgClass: "bg-muted", textClass: "text-muted-foreground", icon: Clock },
  active: { label: "Active", bgClass: "bg-blue-500/15", textClass: "text-blue-600", icon: Users },
  onboarding: { label: "Onboarding", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: Clock },
  ready: { label: "Ready", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  assigned: { label: "Assigned", bgClass: "bg-purple-500/15", textClass: "text-purple-600", icon: UserCheck },
  inactive: { label: "Inactive", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: UserX },
};

const statusTabs: { value: ParticipantStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "imported", label: "Imported" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "ready", label: "Ready" },
  { value: "assigned", label: "Assigned" },
];

function ParticipantRow({ participant }: { participant: Participant }) {
  const config = statusConfig[participant.status];
  const StatusIcon = config.icon;

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <td className="p-4">
        <div>
          <Link
            href={`/portal/participants/${participant.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {participant.firstName} {participant.lastName}
          </Link>
          <p className="text-sm text-muted-foreground">{participant.email}</p>
        </div>
      </td>
      <td className="p-4">
        <code className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
          {participant.participantId}
        </code>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{participant.country}</span>
        </div>
      </td>
      <td className="p-4">
        {participant.institution ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <GraduationCap className="h-3 w-3 text-muted-foreground" />
            <span className="truncate max-w-[150px]">{participant.institution}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4">
        {participant.onboardingComplete ? (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-600">
            Complete
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            Pending
          </span>
        )}
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(participant.createdAt), "MMM d, yyyy")}
      </td>
      <td className="p-4">
        <Link
          href={`/portal/participants/${participant.id}`}
          className="p-2 rounded-lg hover:bg-muted inline-flex text-muted-foreground hover:text-muted-foreground"
        >
          <Eye className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function ParticipantsContent() {
  const [statusFilter, setStatusFilter] = useState<ParticipantStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [showFilters, setShowFilters] = useState(false);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  const { data: participantsData, isLoading } = useParticipants({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    cohortId: selectedCohortId || undefined,
    page,
    limit: pageSize,
  });
  const { data: stats } = useParticipantStatistics(selectedCohortId || undefined);

  const participants = participantsData?.data || [];
  const totalPages = participantsData?.totalPages || 1;
  const totalItems = participantsData?.total || 0;

  const activeFilterCount = [
    statusFilter !== "all",
    selectedCohortId !== "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setStatusFilter("all");
    setSelectedCohortId("");
    setPage(1);
  };

  const handlePageSizeChange = (newPageSize: PageSize) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when page size changes
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Participants</h1>
          <p className="text-sm text-muted-foreground">
            Manage participants and bulk imports
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
            <div className="mt-1 text-2xl font-semibold text-blue-600">
              {stats?.active || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Onboarding</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">
              {stats?.onboarding || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Ready</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">
              {stats?.ready || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Assigned</div>
            <div className="mt-1 text-2xl font-semibold text-purple-600">
              {stats?.assigned || 0}
            </div>
          </div>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
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
          <Link
            href="/portal/participants/import"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </Link>
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
        ) : participants.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">No participants found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "No participants match your search."
                : "Import participants to get started."}
            </p>
            <Link
              href="/portal/participants/import"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Participant ID</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Country</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Institution</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Onboarding</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Imported</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant) => (
                    <ParticipantRow key={participant.id} participant={participant} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>
    </StaffLayout>
  );
}

export default function ParticipantsPage() {
  return (
    <ProtectedRoute portal="staff">
      <ParticipantsContent />
    </ProtectedRoute>
  );
}
