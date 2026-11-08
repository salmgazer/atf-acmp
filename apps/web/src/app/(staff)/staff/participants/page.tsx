"use client";

import { StaffOnly, useStaffPermission } from "@/components/auth/staff-only";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useState, useEffect } from "react";
import { GroupFilter } from "@/components/cohorts/group-filter";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  useParticipants,
  useParticipantStatistics,
  useResendParticipantInvites,
  useParticipantInviteBatch,
  canResendParticipantInvite,
  type ParticipantInviteRequest,
  type Participant,
  type ParticipantStatus,
} from "@/lib/api/hooks/use-participants";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { TablePagination, type PageSize } from "@/components/ui/table-pagination";
import {
  Search,
  Users,
  Clock,
  CheckCircle,
  UserCheck,
  UserX,
  Eye,
  MoreHorizontal,
  Send,
  Loader2,
  Upload,
  Download,
  MapPin,
  GraduationCap,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

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

function ParticipantRow({ participant, selected, onSelect, onResend, busy }: {
  participant: Participant;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onResend: () => void;
  busy: boolean;
}) {
  const config = statusConfig[participant.status];
  const StatusIcon = config.icon;

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <StaffOnly permission="manage"><td className="p-4">
        <Checkbox aria-label={`Select ${participant.firstName} ${participant.lastName}`} checked={selected}
          disabled={busy || !canResendParticipantInvite(participant)} onCheckedChange={checked => onSelect(checked === true)} />
      </td></StaffOnly>
      <td className="p-4">
        <div>
          <Link
            href={`/staff/participants/${participant.id}`}
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
      <td className="p-4 text-sm">{participant.group || "Not assigned"}</td>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${participant.firstName} ${participant.lastName}`}><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/staff/participants/${participant.id}`}><Eye className="mr-2 h-4 w-4" />View participant</Link></DropdownMenuItem>
            <StaffOnly permission="manage"><DropdownMenuItem disabled={busy || !canResendParticipantInvite(participant)} onClick={onResend}>
              <Send className="mr-2 h-4 w-4" />Resend invite
            </DropdownMenuItem></StaffOnly>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ParticipantsContent() {
  const canManage = useStaffPermission("manage");
  const userId = useAuthStore(state => state.user?.id);
  const batchStorageKey = userId ? `acmp-participant-invite-batch:${userId}` : null;
  const [statusFilter, setStatusFilter] = useState<ParticipantStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<"selected" | "pending" | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const resend = useResendParticipantInvites();
  const { data: batch, isError: batchError, error: batchFailure, refetch: refreshBatch } = useParticipantInviteBatch(canManage ? batchId : null);
  const sending = resend.isPending || (!!batchId && (!batch || batch.state === "queued" || batch.state === "active"));

  useEffect(() => {
    if (!canManage || !batchStorageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(batchStorageKey) || "null");
      if (saved?.id && saved.createdAt > Date.now() - 86400000) setBatchId(saved.id);
      else sessionStorage.removeItem(batchStorageKey);
    } catch { /* Progress remains available for the current page when storage is unavailable. */ }
  }, [canManage, batchStorageKey]);

  useEffect(() => {
    if (isAxiosError(batchFailure) && batchFailure.response?.status === 404) {
      setBatchId(null);
      if (batchStorageKey) try { sessionStorage.removeItem(batchStorageKey); } catch { /* Optional cache. */ }
    }
  }, [batchFailure, batchStorageKey]);

  // Get global cohort from store (set by sidebar)
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);

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
  const groupOptions = Array.from(new Set(cohorts.filter(c => !effectiveCohortId || c.id === effectiveCohortId).flatMap(c => c.groups || [])));
  useEffect(() => { setGroupFilter("all"); setPage(1); }, [effectiveCohortId]);

  const { data: participantsData, isLoading } = useParticipants({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    cohortId: effectiveCohortId,
    group: groupFilter.startsWith("group:") ? groupFilter.slice(6) : undefined,
    ungrouped: groupFilter === "ungrouped" || undefined,
    page,
    limit: pageSize,
  });
  const { data: stats } = useParticipantStatistics(effectiveCohortId);

  const participants = participantsData?.data || [];
  const totalPages = participantsData?.totalPages || 1;
  const totalItems = participantsData?.total || 0;
  const selectable = participants.filter(canResendParticipantInvite);
  const allSelected = selectable.length > 0 && selectable.every(participant => selectedIds.includes(participant.id));
  const someSelected = selectable.some(participant => selectedIds.includes(participant.id));
  const cohortName = cohorts.find(cohort => cohort.id === effectiveCohortId)?.name;

  useEffect(() => { setSelectedIds([]); setConfirmation(null); }, [page, pageSize, effectiveCohortId, statusFilter, search, groupFilter, canManage]);

  const queueInvites = async (request: ParticipantInviteRequest) => {
    try {
      const queued = await resend.mutateAsync(request);
      setBatchId(queued.id);
      if (batchStorageKey) try { sessionStorage.setItem(batchStorageKey, JSON.stringify({ id: queued.id, createdAt: Date.now() })); } catch { /* Optional progress cache. */ }
      setSelectedIds([]);
      setConfirmation(null);
    } catch { /* The mutation displays the request error; keep the selection for correction. */ }
  };

  const confirmResend = () => {
    if (confirmation === "selected") return queueInvites({ mode: "selected", participantIds: selectedIds });
    if (confirmation === "pending" && effectiveCohortId) return queueInvites({ mode: "pending", filters: {
      cohortId: effectiveCohortId,
      group: groupFilter.startsWith("group:") ? groupFilter.slice(6) : undefined,
      ungrouped: groupFilter === "ungrouped" || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
    } });
  };

  const activeFilterCount = [
    groupFilter !== "all",
    statusFilter !== "all",
    selectedCohortId !== null && selectedCohortId !== globalCohortId,
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all participants with current filters (no pagination limit)
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (effectiveCohortId) params.set("cohortId", effectiveCohortId);
      if (groupFilter.startsWith("group:")) params.set("group", groupFilter.slice(6));
      if (groupFilter === "ungrouped") params.set("ungrouped", "true");
      params.set("limit", "500");
      const allParticipants: Participant[] = [];
      let exportPage = 1;
      let exportPages = 1;
      do {
        params.set("page", String(exportPage));
        const response = await api.get<{ data: Participant[]; totalPages: number }>(`/participants?${params.toString()}`);
        allParticipants.push(...response.data);
        exportPages = response.totalPages || 1;
        exportPage++;
      } while (exportPage <= exportPages);

      if (allParticipants.length === 0) {
        toast.error("No participants to export");
        return;
      }

      // Generate CSV content
      const headers = [
        "Participant ID",
        "Email",
        "First Name",
        "Last Name",
        "Country",
        "Group",
        "Institution",
        "Phone Number",
        "Status",
        "Onboarding Complete",
        "Skills",
        "Interests",
        "Created At",
        "LMS Email", "WhatsApp Number", "City", "Location Type", "Gender", "Education Level", "Current Affiliation", "Field of Study", "Python Skill", "Git Skill", "AI Experience", "GitHub Username",
        "Learning Certificate Issued", "Learning Certificate ID", "Learning Certificate Date", "Learning Finished All Lessons", "Learning Halfway Reached",
      ];

      const rows = allParticipants.map((p) => [
        p.participantId,
        p.email,
        p.firstName,
        p.lastName,
        p.country,
        p.group || "",
        p.institution || "",
        p.phoneNumber || "",
        p.status,
        p.onboardingComplete ? "Yes" : "No",
        (p.skills || []).join("; "),
        (p.interests || []).join("; "),
        format(new Date(p.createdAt), "yyyy-MM-dd HH:mm:ss"),
        p.lmsEmail || "", p.whatsappNumber || "", p.city || "", p.locationType || "", p.gender || "", p.educationLevel || "", p.currentAffiliation || "", p.fieldOfStudy || "", p.pythonSkill || "", p.gitSkill || "", p.aiExperience || "", p.githubUsername || "",
        p.learningCertificateIssued == null ? "" : p.learningCertificateIssued ? "Yes" : "No", p.learningCertificateId || "", p.learningCertificateDate || "",
        p.learningFinishedAllLessons == null ? "" : p.learningFinishedAllLessons ? "Yes" : "No", p.learningHalfwayReached == null ? "" : p.learningHalfwayReached ? "Yes" : "No",
      ]);

      // Escape CSV values
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

      // Download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cohortName = cohorts.find((c) => c.id === effectiveCohortId)?.name || "all";
      const timestamp = format(new Date(), "yyyy-MM-dd");
      link.download = `participants_${cohortName.replace(/\s+/g, "_")}_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allParticipants.length} participants`);
    } catch (error: any) {
      toast.error(error.message || "Failed to export participants");
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setGroupFilter("all");
    setStatusFilter("all");
    setSelectedCohortId(null);
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
        <div className="flex flex-wrap items-center gap-3">
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
          <StaffOnly permission="manage"><Link
            href="/staff/participants/import"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </Link></StaffOnly>
          <StaffOnly permission="manage"><Button variant="outline" disabled={!effectiveCohortId || sending} onClick={() => setConfirmation("pending")}>
            <Send className="mr-2 h-4 w-4" />Resend pending invites
          </Button></StaffOnly>
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
                value={selectedCohortId ?? globalCohortId ?? ""}
                onChange={(e) => {
                  setSelectedCohortId(e.target.value || null);
                  setPage(1);
                }}
                className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
              >
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
            <GroupFilter groups={groupOptions} value={groupFilter} onChange={value => { setGroupFilter(value); setPage(1); }} />
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

        <StaffOnly permission="manage">
          {batchId && <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-border p-4">
            <p className="font-medium">{batch?.state === "completed" ? "Invitation resend complete" : batch?.state === "failed" ? "Invitation resend stopped" : "Resending invitations"}</p>
            {batch && <p className="text-sm text-muted-foreground">{batch.processed} of {batch.total} processed · {batch.sent} sent · {batch.failed} failed · {batch.skipped} skipped</p>}
            {batch?.error && <p className="text-sm text-destructive">{batch.error}</p>}
            {!!batch?.failed && <p className="text-sm text-destructive">Failed participant IDs: {batch.failures.map(failure => failure.participantId).join(", ")}{batch.failed > batch.failures.length ? " (first 100 shown)" : ""}</p>}
            {batchError && <div className="flex items-center gap-3"><p className="text-sm text-destructive">Could not load progress.</p><Button size="sm" variant="outline" onClick={() => refreshBatch()}>Refresh progress</Button></div>}
          </div>}
          {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
            <span className="text-sm font-medium">{selectedIds.length} selected on this page</span>
            <Button size="sm" disabled={sending} onClick={() => setConfirmation("selected")}><Send className="mr-2 h-4 w-4" />Resend selected invites</Button>
            <Button size="sm" variant="ghost" disabled={sending} onClick={() => setSelectedIds([])}>Clear selection</Button>
          </div>}
        </StaffOnly>

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
            <StaffOnly permission="manage"><Link
              href="/staff/participants/import"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </Link></StaffOnly>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <StaffOnly permission="manage"><th className="p-4 w-12">
                      <Checkbox aria-label="Select all pending participants on this page" checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        disabled={sending || !selectable.length} onCheckedChange={checked => setSelectedIds(checked === true ? selectable.map(participant => participant.id) : [])} />
                    </th></StaffOnly>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Participant ID</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Country</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Group</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Institution</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Onboarding</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Imported</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant) => (
                    <ParticipantRow key={participant.id} participant={participant} selected={selectedIds.includes(participant.id)} busy={sending}
                      onSelect={checked => setSelectedIds(ids => checked ? [...new Set([...ids, participant.id])] : ids.filter(id => id !== participant.id))}
                      onResend={() => queueInvites({ mode: "single", participantId: participant.id })} />
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
        <StaffOnly permission="manage"><Dialog open={confirmation !== null} onOpenChange={open => { if (!open && !resend.isPending) setConfirmation(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{confirmation === "selected" ? "Resend selected invites?" : "Resend pending invites?"}</DialogTitle>
              <DialogDescription>{confirmation === "selected"
                ? `Send the invitation email again to ${selectedIds.length} selected participant${selectedIds.length === 1 ? "" : "s"}?`
                : `Send invitations to all pending participants in ${cohortName || "the selected cohort"} matching the current filters, across all pages?`}
              </DialogDescription></DialogHeader>
            <p className="text-sm text-muted-foreground">Pending participants still need to change their initial password. Inactive accounts and participants who have already changed it are excluded.</p>
            <DialogFooter><Button variant="outline" disabled={resend.isPending} onClick={() => setConfirmation(null)}>Cancel</Button>
              <Button disabled={resend.isPending || sending || (confirmation === "selected" && selectedIds.length === 0)} onClick={confirmResend}>
                {resend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send invitations
              </Button></DialogFooter>
          </DialogContent>
        </Dialog></StaffOnly>
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
