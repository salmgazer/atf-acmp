"use client";

import { useState } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CohortCard } from "@/components/cohorts/cohort-card";
import { CohortsTable } from "@/components/cohorts/cohorts-table";
import { Button } from "@/components/ui/button";
import {
  useCohorts,
  useDeleteCohort,
  useDuplicateCohort,
  type Cohort,
  type CohortStatus,
} from "@/lib/api/hooks/use-cohorts";
import {
  Plus,
  Loader2,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusFilters: { label: string; value: CohortStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Evaluation", value: "evaluation" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

function CohortsContent() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [statusFilter, setStatusFilter] = useState<CohortStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<Cohort | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<Cohort | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hasActiveFilters = statusFilter !== "all";

  const { data, isLoading, error } = useCohorts({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 12,
  });

  const deleteMutation = useDeleteCohort();
  const duplicateMutation = useDuplicateCohort();

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await deleteMutation.mutateAsync(deleteDialog.id);
    setDeleteDialog(null);
  };

  const handleDuplicate = async () => {
    if (!duplicateDialog || !duplicateName.trim()) return;
    await duplicateMutation.mutateAsync({
      id: duplicateDialog.id,
      name: duplicateName.trim(),
    });
    setDuplicateDialog(null);
    setDuplicateName("");
  };

  const openDuplicateDialog = (cohort: Cohort) => {
    setDuplicateName(`${cohort.name} (Copy)`);
    setDuplicateDialog(cohort);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "10000");

      const response = await api.get<{ data: Cohort[] }>(`/cohorts?${params.toString()}`);
      let allCohorts = response.data;

      // Apply search filter locally
      if (searchQuery) {
        allCohorts = allCohorts.filter(
          (cohort) =>
            cohort.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cohort.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      if (allCohorts.length === 0) {
        toast.error("No cohorts to export");
        return;
      }

      const headers = [
        "Name",
        "Description",
        "Status",
        "Team Size Min",
        "Team Size Max",
        "Brief Cap",
        "Max Teams Per Brief",
        "Session Rate",
        "Countries",
        "Verticals",
        "Team Formation End",
        "Brief Selection End",
        "Stage 1 End",
        "Stage 2 End",
        "Stage 3 End",
        "Demo Day",
        "Created At",
      ];

      const rows = allCohorts.map((c) => [
        c.name,
        c.description || "",
        c.status,
        String(c.teamSizeMin),
        String(c.teamSizeMax),
        String(c.briefCap),
        String(c.maxTeamsPerBrief),
        c.sessionRate !== null && c.sessionRate !== undefined ? String(c.sessionRate) : "",
        (c.countries || []).join("; "),
        (c.verticals || []).join("; "),
        c.deadlines?.teamFormationEnd || "",
        c.deadlines?.briefSelectionEnd || "",
        c.deadlines?.stage1End || "",
        c.deadlines?.stage2End || "",
        c.deadlines?.stage3End || "",
        c.deadlines?.demoDay || "",
        format(new Date(c.createdAt), "yyyy-MM-dd HH:mm:ss"),
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
      const timestamp = format(new Date(), "yyyy-MM-dd");
      link.download = `cohorts_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allCohorts.length} cohorts`);
    } catch (error: any) {
      toast.error(error.message || "Failed to export cohorts");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredCohorts =
    data?.data.filter(
      (cohort) =>
        cohort.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cohort.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cohorts</h1>
            <p className="text-sm text-muted-foreground">
              Manage AI Challenge cohorts and their configurations
            </p>
          </div>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cohorts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${
                viewMode === "grid" ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 ${
                viewMode === "table" ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <List className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
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
          <Button asChild className="bg-zinc-900 text-white hover:bg-zinc-800">
            <Link href="/portal/cohorts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Cohort
            </Link>
          </Button>
        </div>

        {/* Collapsible Filter Row */}
        {showFilters && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === filter.value
                      ? "bg-zinc-900 text-white"
                      : "bg-card text-muted-foreground border border-border hover:bg-muted"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-red-600">
            Failed to load cohorts. Please try again.
          </div>
        ) : filteredCohorts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? "No cohorts match your search"
                : statusFilter !== "all"
                ? `No ${statusFilter} cohorts found`
                : "No cohorts yet. Create your first cohort to get started."}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button asChild className="mt-4 bg-zinc-900 text-white hover:bg-zinc-800">
                <Link href="/portal/cohorts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Cohort
                </Link>
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCohorts.map((cohort) => (
              <CohortCard
                key={cohort.id}
                cohort={cohort}
                onDuplicate={openDuplicateDialog}
                onDelete={setDeleteDialog}
              />
            ))}
          </div>
        ) : (
          <CohortsTable
            cohorts={filteredCohorts}
            onDuplicate={openDuplicateDialog}
            onDelete={setDeleteDialog}
          />
        )}

        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.meta.totalPages}
            </span>
            <button
              disabled={page === data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Cohort</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete &quot;{deleteDialog?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} className="border-border">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Duplicate Cohort</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a copy of &quot;{duplicateDialog?.name}&quot; with a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="New cohort name"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              className="rounded-lg border-border"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialog(null)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending || !duplicateName.trim()}
              className="bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {duplicateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function CohortsPage() {
  return (
    <ProtectedRoute portal="staff">
      <CohortsContent />
    </ProtectedRoute>
  );
}
