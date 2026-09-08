"use client";

import { useState } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMentors,
  useMentorStatistics,
  type Mentor,
  type MentorStatus,
} from "@/lib/api/hooks/use-mentors";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { MentorFormDialog } from "@/components/mentors/mentor-form-dialog";
import {
  Search,
  UserPlus,
  Eye,
  Loader2,
  GraduationCap,
  Building2,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  SlidersHorizontal,
  X,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<
  MentorStatus,
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  imported: { label: "Imported", bgClass: "bg-muted", textClass: "text-muted-foreground", icon: Clock },
  active: { label: "Active", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  inactive: { label: "Inactive", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
};

const statusTabs: { value: MentorStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "imported", label: "Imported" },
  { value: "inactive", label: "Inactive" },
];

function MentorRow({ mentor, onEdit }: { mentor: Mentor; onEdit: (mentor: Mentor) => void }) {
  const config = statusConfig[mentor.status];
  const StatusIcon = config.icon;
  const assignedCount = mentor.assignments?.filter((a) => a.isActive)?.length || 0;
  const capacityPercent = (assignedCount / mentor.maxTeams) * 100;

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">
              {mentor.firstName[0]}
              {mentor.lastName[0]}
            </span>
          </div>
          <div>
            <Link
              href={`/portal/mentors/${mentor.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {mentor.firstName} {mentor.lastName}
            </Link>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {mentor.email}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4">
        {mentor.company ? (
          <div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {mentor.company}
            </div>
            {mentor.title && (
              <div className="text-xs text-muted-foreground">{mentor.title}</div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </td>
      <td className="p-4">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {mentor.expertise.slice(0, 3).map((skill) => (
            <span key={skill} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {skill}
            </span>
          ))}
          {mentor.expertise.length > 3 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              +{mentor.expertise.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="p-4">
        <div className="w-32">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-foreground font-medium">
              {assignedCount}/{mentor.maxTeams}
            </span>
            <span className="text-muted-foreground">{Math.round(capacityPercent)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-zinc-900 rounded-full transition-all"
              style={{ width: `${Math.min(capacityPercent, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(mentor.createdAt), "MMM d, yyyy")}
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
              <Link href={`/portal/mentors/${mentor.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(mentor)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function MentorsContent() {
  const [statusFilter, setStatusFilter] = useState<MentorStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingMentor, setEditingMentor] = useState<Mentor | null>(null);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  const { data: mentorsData, isLoading } = useMentors({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    cohortId: selectedCohortId || undefined,
    hasCapacity: capacityFilter === "all" ? undefined : capacityFilter === "available",
    page,
    limit: 20,
  });

  const { data: stats } = useMentorStatistics(selectedCohortId || undefined);

  const mentors = mentorsData?.data || [];
  const totalPages = mentorsData?.totalPages || 1;

  const activeFilterCount = [
    statusFilter !== "all",
    selectedCohortId !== "",
    capacityFilter !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setStatusFilter("all");
    setSelectedCohortId("");
    setCapacityFilter("all");
    setPage(1);
  };

  const handleEditClick = (mentor: Mentor) => {
    setEditingMentor(mentor);
    setShowFormDialog(true);
  };

  const handleFormDialogClose = (open: boolean) => {
    setShowFormDialog(open);
    if (!open) {
      setEditingMentor(null);
    }
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mentors</h1>
          <p className="text-sm text-muted-foreground">
            Manage mentors, assignments, and capacity
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
            <div className="text-sm text-muted-foreground">Teams Assigned</div>
            <div className="mt-1 text-2xl font-semibold text-blue-600">
              {stats?.assignedTeams || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Available Slots</div>
            <div className="mt-1 text-2xl font-semibold text-purple-600">
              {stats?.availableSlots || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Session Hours</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.totalSessionHours || 0}h</div>
          </div>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search mentors..."
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
            href="/portal/mentors/import"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link
            href="/portal/mentors/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <UserPlus className="h-4 w-4" />
            Add Mentor
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Capacity:</span>
              <select
                value={capacityFilter}
                onChange={(e) => {
                  setCapacityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
              >
                <option value="all">All Mentors</option>
                <option value="available">Has Capacity</option>
                <option value="full">At Capacity</option>
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
        ) : mentors.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
              <GraduationCap className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">No mentors found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "No mentors match your search criteria."
                : "Import or add mentors to get started."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/portal/mentors/import"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                Import CSV
              </Link>
              <Link
                href="/portal/mentors/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Add Mentor
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mentor</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Organization</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Expertise</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Capacity</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Added</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mentors.map((mentor) => (
                    <MentorRow key={mentor.id} mentor={mentor} onEdit={handleEditClick} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({mentorsData?.total} total)
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

      {/* Edit Mentor Dialog */}
      <MentorFormDialog
        open={showFormDialog}
        onOpenChange={handleFormDialogClose}
        mentor={editingMentor}
      />
    </StaffLayout>
  );
}

export default function MentorsPage() {
  return (
    <ProtectedRoute portal="staff">
      <MentorsContent />
    </ProtectedRoute>
  );
}
