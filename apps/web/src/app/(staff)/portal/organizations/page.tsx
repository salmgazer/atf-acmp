"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  useOrganizations,
  useOrganizationStatistics,
  useApproveOrganization,
  useRejectOrganization,
  useSendOrganizationInvite,
  useBulkSendInvites,
  type Organization,
  type OrganizationStatus,
} from "@/lib/api/hooks/use-organizations";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { OrganizationFormDialog } from "@/components/organizations/organization-form-dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { format } from "date-fns";

const statusConfig: Record<OrganizationStatus, { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }> = {
  pending: { label: "Pending", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: Clock },
  approved: { label: "Approved", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejected", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
};

const statusTabs: { value: OrganizationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function OrganizationRow({ 
  organization,
  onApprove,
  onReject,
  onSendInvite,
  onEdit,
}: { 
  organization: Organization;
  onApprove: (org: Organization) => void;
  onReject: (org: Organization) => void;
  onSendInvite: (org: Organization) => void;
  onEdit: (org: Organization) => void;
}) {
  const config = statusConfig[organization.status];
  const StatusIcon = config.icon;

  return (
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
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
              href={`/portal/organizations/${organization.id}`}
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
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/portal/organizations/${organization.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(organization)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSendInvite(organization)}>
              <Mail className="mr-2 h-4 w-4" />
              Send Invite
            </DropdownMenuItem>
            {organization.status === "pending" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onApprove(organization)} className="text-emerald-600">
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReject(organization)} className="text-destructive">
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function OrganizationsContent() {
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | "all">("all");
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
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

  const { data: orgsData, isLoading } = useOrganizations({
    status: statusFilter === "all" ? undefined : statusFilter,
    cohortId: effectiveCohortId,
    search: search || undefined,
    limit: 100,
  });
  const { data: stats } = useOrganizationStatistics();
  const approveMutation = useApproveOrganization();
  const rejectMutation = useRejectOrganization();
  const sendInviteMutation = useSendOrganizationInvite();

  const organizations = orgsData?.data || [];
  const hasActiveFilters = statusFilter !== "all" || (selectedCohortId !== null && selectedCohortId !== globalCohortId);

  const handleApprove = async (org: Organization) => {
    await approveMutation.mutateAsync({ id: org.id });
  };

  const handleRejectClick = (org: Organization) => {
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

  const handleSendInvite = async (org: Organization) => {
    await sendInviteMutation.mutateAsync({ id: org.id });
  };

  const handleAddClick = () => {
    setEditingOrg(null);
    setShowFormDialog(true);
  };

  const handleEditClick = (org: Organization) => {
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

      const response = await api.get<{ data: Organization[] }>(`/organizations?${params.toString()}`);
      const allOrgs = response.data;

      if (allOrgs.length === 0) {
        toast.error("No organizations to export");
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
      link.download = `organizations_${cohortName.replace(/\s+/g, "_")}_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allOrgs.length} organizations`);
    } catch (error: any) {
      toast.error(error.message || "Failed to export organizations");
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
            <h1 className="text-2xl font-semibold text-foreground">Organizations</h1>
            <p className="text-sm text-muted-foreground">
              Manage organization registrations and approvals
            </p>
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

        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search organizations..."
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
          <div className="flex items-center gap-2 ml-auto">
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
            <Button variant="outline" onClick={handleAddClick} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
            <Link href="/portal/organizations/import">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </Link>
          </div>
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
                    onClick={() => setSelectedCohortId(cohort.id === globalCohortId ? null : cohort.id)}
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
            <h3 className="mt-4 text-lg font-medium text-foreground">No organizations found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusFilter === "pending"
                ? "No organizations are waiting for approval."
                : "No organizations match your current filters."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Organization</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Industry</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Registered</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <OrganizationRow
                    key={org.id}
                    organization={org}
                    onApprove={handleApprove}
                    onReject={handleRejectClick}
                    onSendInvite={handleSendInvite}
                    onEdit={handleEditClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Organization</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Please provide a reason for rejecting &quot;{selectedOrg?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Reason for Rejection *</Label>
              <Textarea
                placeholder="Explain why this organization is being rejected..."
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
      </Dialog>

      {/* Add/Edit Organization Dialog */}
      <OrganizationFormDialog
        open={showFormDialog}
        onOpenChange={handleFormDialogClose}
        organization={editingOrg}
      />
    </StaffLayout>
  );
}

export default function OrganizationsPage() {
  return (
    <ProtectedRoute portal="staff">
      <OrganizationsContent />
    </ProtectedRoute>
  );
}
