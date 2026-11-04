"use client";

import { StaffOnly, useStaffPermission } from "@/components/auth/staff-only";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isAxiosError } from "axios";
import { useState, useEffect } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  usePartners,
  usePartnerStatistics,
  useApprovePartner,
  useRejectPartner,
  useSendPartnerInvite,
  useResendPartnerInvites,
  usePartnerInviteBatch,
  type PartnerBulkInviteRequest,
  type Partner,
  type PartnerStatus,
} from "@/lib/api/hooks/use-organizations";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { PartnerEventsCalendar } from "@/components/partners/partner-events-calendar";
import { PartnerFormDialog } from "@/components/partners/partner-form-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  SlidersHorizontal,
  X,
  Upload,
  Download,
  Mail,
  MoreHorizontal,
  Plus,
  Pencil,
  Calendar,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { format } from "date-fns";

const statusConfig: Record<PartnerStatus, { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }> = {
  pending: { label: "Pending", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: Clock },
  approved: { label: "Approved", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejected", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
};

const statusTabs: { value: PartnerStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function PartnerRow({
  organization,
  onApprove,
  onReject,
  onSendInvite,
  onEdit,
  selected,
  onSelect,
  bulkBusy,
}: {
  organization: Partner;
  onApprove: (org: Partner) => void;
  onReject: (org: Partner) => void;
  onSendInvite: (org: Partner) => void;
  onEdit: (org: Partner) => void;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  bulkBusy: boolean;
}) {
  const config = statusConfig[organization.status];
  const StatusIcon = config.icon;

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
      <StaffOnly permission="manage"><td className="p-4">
        <Checkbox aria-label={`Select ${organization.name}`} checked={selected}
          disabled={bulkBusy || !organization.isActive || organization.status !== "approved"} onCheckedChange={checked => onSelect(checked === true)} />
      </td></StaffOnly>
      <td className="p-4">
        <div className="flex items-center gap-3">
          {organization.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <Link
              href={`/staff/partners/${organization.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {organization.name}
            </Link>
            <p className="text-sm text-muted-foreground">{organization.email}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {organization.country && (
            <>
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>{organization.country}</span>
            </>
          )}
        </div>
      </td>
      <td className="p-4 text-sm text-muted-foreground">{organization.industry || "—"}</td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(organization.createdAt), "MMM d, yyyy")}
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${organization.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/staff/partners/${organization.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <StaffOnly permission="manage"><DropdownMenuItem onClick={() => onEdit(organization)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem></StaffOnly>
            {organization.status === "approved" && organization.isActive && <StaffOnly permission="manage"><DropdownMenuItem disabled={bulkBusy} onClick={() => onSendInvite(organization)}>
              <Mail className="mr-2 h-4 w-4" />
              Resend Invite
            </DropdownMenuItem></StaffOnly>}
            {organization.status === "pending" && (
              <>
                <DropdownMenuSeparator />
                <StaffOnly permission="manage"><DropdownMenuItem onClick={() => onApprove(organization)} className="text-emerald-600">
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem></StaffOnly>
                <StaffOnly permission="manage"><DropdownMenuItem onClick={() => onReject(organization)} className="text-destructive">
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </DropdownMenuItem></StaffOnly>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function PartnersContent() {
  const canManage = useStaffPermission("manage");
  const userId = useAuthStore(state => state.user?.id);
  const batchStorageKey = userId ? `acmp-partner-invite-batch:${userId}` : null;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<"selected" | "eligible" | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const resendBulk = useResendPartnerInvites();
  const { data: batch, isError: batchError, error: batchFailure, refetch: refreshBatch } = usePartnerInviteBatch(canManage ? batchId : null);
  const bulkBusy = resendBulk.isPending || (!!batchId && (!batch || ["queued", "active"].includes(batch.state)));

  useEffect(() => {
    if (!canManage || !batchStorageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(batchStorageKey) || "null");
      if (saved?.id && saved.createdAt > Date.now() - 86400000) setBatchId(saved.id);
      else sessionStorage.removeItem(batchStorageKey);
    } catch { /* Optional progress cache. */ }
  }, [canManage, batchStorageKey]);
  useEffect(() => {
    if (isAxiosError(batchFailure) && batchFailure.response?.status === 404) {
      setBatchId(null);
      if (batchStorageKey) try { sessionStorage.removeItem(batchStorageKey); } catch { /* Optional cache. */ }
    }
  }, [batchFailure, batchStorageKey]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | "all">("all");
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Partner | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Partner | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Get global cohort from store (set by sidebar)
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  // Initialize local cohort from global when component mounts or global changes (if not yet set locally)
  useEffect(() => {
    if (globalCohortId && !hasInitialized) {
      setSelectedCohortId(null); // null means "use global"
      setHasInitialized(true);
    }
  }, [globalCohortId, hasInitialized]);

  // Use local cohort if explicitly set, otherwise fall back to global
  const effectiveCohortId = selectedCohortId ?? globalCohortId ?? undefined;

  const { data: orgsData, isLoading } = usePartners({
    status: statusFilter === "all" ? undefined : statusFilter,
    cohortId: effectiveCohortId,
    search: search || undefined,
    page,
    limit: 20,
  });
  const { data: stats } = usePartnerStatistics();
  const approveMutation = useApprovePartner();
  const rejectMutation = useRejectPartner();
  const sendInviteMutation = useSendPartnerInvite();

  const organizations = orgsData?.data || [];
  const totalPages = orgsData?.totalPages || 1;
  const selectable = organizations.filter(org => org.status === "approved" && org.isActive);
  const allSelected = selectable.length > 0 && selectable.every(org => selectedIds.includes(org.id));
  const someSelected = selectable.some(org => selectedIds.includes(org.id));
  const cohortName = cohorts.find(cohort => cohort.id === effectiveCohortId)?.name;

  useEffect(() => { setSelectedIds([]); setConfirmation(null); }, [page, effectiveCohortId, statusFilter, search, canManage, view]);
  useEffect(() => { setPage(1); }, [effectiveCohortId]);

  const queueInvites = async (request: PartnerBulkInviteRequest) => {
    try {
      const queued = await resendBulk.mutateAsync(request);
      setBatchId(queued.id);
      if (batchStorageKey) try { sessionStorage.setItem(batchStorageKey, JSON.stringify({ id: queued.id, createdAt: Date.now() })); } catch { /* Optional progress cache. */ }
      setSelectedIds([]);
      setConfirmation(null);
    } catch { /* The mutation displays the error; preserve selection for correction. */ }
  };
  const confirmResend = () => {
    if (confirmation === "selected") return queueInvites({ mode: "selected", organizationIds: selectedIds });
    if (confirmation === "eligible" && effectiveCohortId && (statusFilter === "all" || statusFilter === "approved")) return queueInvites({ mode: "eligible", filters: {
      cohortId: effectiveCohortId, search: search || undefined, status: statusFilter === "all" ? undefined : statusFilter,
    } });
  };

  const hasActiveFilters = statusFilter !== "all" || (selectedCohortId !== null && selectedCohortId !== globalCohortId);

  const handleApprove = async (org: Partner) => {
    await approveMutation.mutateAsync({ id: org.id });
  };

  const handleRejectClick = (org: Partner) => {
    setSelectedOrg(org);
    setRejectReason("");
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedOrg) return;
    await rejectMutation.mutateAsync({ id: selectedOrg.id, reason: rejectReason });
    setShowRejectDialog(false);
    setSelectedOrg(null);
  };

  const handleSendInvite = async (org: Partner) => {
    try { await sendInviteMutation.mutateAsync({ id: org.id }); } catch { /* The mutation displays the delivery error. */ }
  };

  const handleAddClick = () => {
    setEditingOrg(null);
    setShowFormDialog(true);
  };

  const handleEditClick = (org: Partner) => {
    setEditingOrg(org);
    setShowFormDialog(true);
  };

  const handleFormDialogClose = (open: boolean) => {
    setShowFormDialog(open);
    if (!open) {
      setEditingOrg(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (effectiveCohortId) params.set("cohortId", effectiveCohortId);
      params.set("limit", "10000");

      const response = await api.get<{ data: Partner[] }>(`/organizations?${params.toString()}`);
      const allOrgs = response.data;

      if (allOrgs.length === 0) {
        toast.error("No partners to export");
        return;
      }

      const headers = [
        "Name",
        "Email",
        "Website",
        "Industry",
        "Country",
        "Contact Person",
        "Contact Phone",
        "Description",
        "Status",
        "Created At",
      ];

      const rows = allOrgs.map((o) => [
        o.name,
        o.email,
        o.website || "",
        o.industry || "",
        o.country || "",
        o.contactPerson || "",
        o.contactPhone || "",
        o.description || "",
        o.status,
        format(new Date(o.createdAt), "yyyy-MM-dd HH:mm:ss"),
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
      link.download = `partners_${cohortName.replace(/\s+/g, "_")}_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allOrgs.length} partners`);
    } catch (error: any) {
      toast.error(error.message || "Failed to export partners");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Partners</h1>
            <p className="text-sm text-muted-foreground">
              Manage partner registrations and approvals
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1" role="group" aria-label="Partners view">
            <button onClick={() => setView("list")} aria-pressed={view === "list"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="h-4 w-4" />List
            </button>
            <button onClick={() => setView("calendar")} aria-pressed={view === "calendar"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Calendar className="h-4 w-4" />Calendar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.total || 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">
              {stats?.pending || 0}
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
        </div>

        <StaffOnly permission="manage">{batchId && <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-border p-4">
          <p className="font-medium">{batch?.state === "completed" ? "Partner invitation resend complete" : batch?.state === "failed" ? "Partner invitation resend stopped" : "Resending partner invitations"}</p>
          {batch && <p className="text-sm text-muted-foreground">{batch.processed} of {batch.total} processed · {batch.sent} sent · {batch.failed} failed · {batch.skipped} skipped</p>}
          {batch?.error && <p className="text-sm text-destructive">{batch.error}</p>}
          {!!batch?.failed && <p className="text-sm text-destructive">Failed partners: {batch.failures.map(failure => failure.email).join(", ")}{batch.failed > batch.failures.length ? " (first 100 shown)" : ""}</p>}
          {batchError && <div className="flex items-center gap-3"><p className="text-sm text-destructive">Could not load progress.</p><Button size="sm" variant="outline" onClick={() => refreshBatch()}>Refresh progress</Button></div>}
        </div>}</StaffOnly>

        {view === "list" && <>
        {/* Search and Filter Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search partners..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
          <div className="flex flex-wrap items-center gap-2 ml-auto">
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
            <StaffOnly permission="manage"><Button variant="outline" onClick={handleAddClick} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button></StaffOnly>
            <StaffOnly permission="manage"><Link href="/staff/partners/import">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </Link></StaffOnly>
            <StaffOnly permission="manage"><Button variant="outline"
              disabled={!effectiveCohortId || bulkBusy || sendInviteMutation.isPending || (statusFilter !== "all" && statusFilter !== "approved")}
              onClick={() => setConfirmation("eligible")}><Mail className="mr-2 h-4 w-4" />Resend approved invites</Button></StaffOnly>
          </div>
        </div>

            <StaffOnly permission="manage">{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
              <span className="text-sm font-medium">{selectedIds.length} selected on this page</span>
              <Button size="sm" disabled={bulkBusy} onClick={() => setConfirmation("selected")}><Mail className="mr-2 h-4 w-4" />Resend selected invites</Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>Clear selection</Button>
            </div>}</StaffOnly>

        {/* Collapsible Filter Row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === tab.value
                        ? "bg-zinc-900 text-white"
                        : "bg-card text-muted-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                    {tab.value === "pending" && (stats?.pending || 0) > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-card/20">
                        {stats?.pending}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Cohort:</span>
              <div className="flex flex-wrap gap-2">
                {cohorts.map((cohort) => (
                  <button
                    key={cohort.id}
                    onClick={() => { setSelectedCohortId(cohort.id === globalCohortId ? null : cohort.id); setPage(1); }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      (selectedCohortId ?? globalCohortId) === cohort.id
                        ? "bg-zinc-900 text-white"
                        : "bg-card text-muted-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {cohort.name}
                    {cohort.status === "active" && (
                      <span className="ml-1 text-xs text-emerald-400">●</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setPage(1);
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

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">No partners found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusFilter === "pending"
                ? "No partners are waiting for approval."
                : "No partners match your current filters."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <StaffOnly permission="manage"><th className="p-4 w-12">
                    <Checkbox aria-label="Select all approved active partners on this page" checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      disabled={bulkBusy || !selectable.length} onCheckedChange={checked => setSelectedIds(checked === true ? selectable.map(org => org.id) : [])} />
                  </th></StaffOnly>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Partner</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Industry</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Registered</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <PartnerRow
                    key={org.id}
                    organization={org}
                    onApprove={handleApprove}
                    onReject={handleRejectClick}
                    onSendInvite={handleSendInvite}
                    onEdit={handleEditClick}
                    selected={selectedIds.includes(org.id)} bulkBusy={bulkBusy || sendInviteMutation.isPending}
                    onSelect={checked => setSelectedIds(ids => checked ? [...new Set([...ids, org.id])] : ids.filter(id => id !== org.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({orgsData?.total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        </div>}
        </>}
        {view === "calendar" && <>
          <div className="flex items-center gap-2">
            <label htmlFor="partner-calendar-cohort" className="text-sm font-medium text-muted-foreground">Cohort</label>
            <select id="partner-calendar-cohort" value={effectiveCohortId || ""} onChange={event => setSelectedCohortId(event.target.value || null)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm">
              {!effectiveCohortId && <option value="">Select a cohort</option>}
              {cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
            </select>
          </div>
          <PartnerEventsCalendar cohortId={effectiveCohortId} />
        </>}
      </div>

      <StaffOnly permission="manage"><Dialog open={confirmation !== null} onOpenChange={open => { if (!open && !resendBulk.isPending) setConfirmation(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{confirmation === "selected" ? "Resend selected partner invites?" : "Resend approved partner invites?"}</DialogTitle>
            <DialogDescription>{confirmation === "selected" ? `Send invitations to ${selectedIds.length} selected approved, active partner${selectedIds.length === 1 ? "" : "s"}?`
              : `Send invitations to all approved, active partners in ${cohortName || "the selected cohort"} matching the current filters, across all pages?`}</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground">Only approved, active, non-deleted partners receive invitations. Each invitation uses the partner’s current email address.</p>
          <DialogFooter><Button variant="outline" disabled={resendBulk.isPending} onClick={() => setConfirmation(null)}>Cancel</Button>
            <Button disabled={bulkBusy || (confirmation === "selected" && !selectedIds.length)} onClick={confirmResend}>
              {resendBulk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send invitations
            </Button></DialogFooter>
        </DialogContent>
      </Dialog></StaffOnly>

      {/* Reject Dialog */}
      <StaffOnly permission="manage"><Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Partner</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Please provide a reason for rejecting &quot;{selectedOrg?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Reason for Rejection *</Label>
              <Textarea
                placeholder="Explain why this partner is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="rounded-lg border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="border-border">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectReason.length < 10 || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></StaffOnly>

      {/* Add/Edit Partner Dialog */}
      <StaffOnly permission="manage"><PartnerFormDialog
        open={showFormDialog}
        onOpenChange={handleFormDialogClose}
        organization={editingOrg}
      /></StaffOnly>
    </StaffLayout>
  );
}

export default function PartnersPage() {
  return (
    <ProtectedRoute portal="staff">
      <PartnersContent />
    </ProtectedRoute>
  );
}
