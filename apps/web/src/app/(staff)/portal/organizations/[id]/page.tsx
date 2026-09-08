"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  useOrganization,
  useUpdateOrganization,
  useApproveOrganization,
  useRejectOrganization,
  useSendOrganizationInvite,
  type Organization,
} from "@/lib/api/hooks/use-organizations";
import { useBriefs } from "@/lib/api/hooks/use-briefs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Send,
  FileText,
  User,
  Briefcase,
  ExternalLink,
} from "lucide-react";

const statusConfig = {
  pending: { label: "Pending Review", bgClass: "bg-amber-500/15", textClass: "text-amber-600", icon: Clock },
  approved: { label: "Approved", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejected", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
};

const briefStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-600" },
  in_review: { label: "In Review", color: "bg-amber-100 text-amber-600" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-600" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600" },
  revision_requested: { label: "Revision Requested", color: "bg-orange-100 text-orange-600" },
};

function OrganizationDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: organization, isLoading, error } = useOrganization(id);
  const { data: briefsData } = useBriefs({ organizationId: id, limit: 100 });
  const updateMutation = useUpdateOrganization();
  const approveMutation = useApproveOrganization();
  const rejectMutation = useRejectOrganization();
  const sendInviteMutation = useSendOrganizationInvite();

  const [activeTab, setActiveTab] = useState("overview");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editForm, setEditForm] = useState<Partial<Organization>>({});

  const briefs = briefsData?.data || [];

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !organization) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Failed to load organization</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/organizations">Back to Organizations</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const config = statusConfig[organization.status];
  const StatusIcon = config.icon;

  const handleApprove = async () => {
    await approveMutation.mutateAsync({ id });
  };

  const handleRejectConfirm = async () => {
    await rejectMutation.mutateAsync({ id, reason: rejectReason });
    setShowRejectDialog(false);
    setRejectReason("");
  };

  const handleSendInvite = async () => {
    await sendInviteMutation.mutateAsync({ id });
  };

  const handleEditSave = async () => {
    await updateMutation.mutateAsync({ id, data: editForm });
    setShowEditDialog(false);
  };

  const openEditDialog = () => {
    setEditForm({
      name: organization.name,
      description: organization.description || "",
      industry: organization.industry || "",
      country: organization.country || "",
      contactPerson: organization.contactPerson || "",
      contactPhone: organization.contactPhone || "",
      website: organization.website || "",
    });
    setShowEditDialog(true);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/portal/organizations">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-start gap-4">
              {organization.logoUrl ? (
                <img
                  src={organization.logoUrl}
                  alt={organization.name}
                  className="h-16 w-16 rounded-xl object-cover border"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center border">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${config.bgClass} ${config.textClass}`}>
                    <StatusIcon className="h-4 w-4" />
                    {config.label}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{organization.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {organization.status === "approved" && (
              <Button variant="outline" onClick={handleSendInvite} disabled={sendInviteMutation.isPending}>
                {sendInviteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Invite
              </Button>
            )}
            {organization.status === "pending" && (
              <>
                <Button variant="default" onClick={handleApprove} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            <Button variant="outline" onClick={openEditDialog}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Rejection Reason Banner */}
        {organization.status === "rejected" && organization.rejectionReason && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200">Rejection Reason</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{organization.rejectionReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="briefs">Briefs ({briefs.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Contact Information */}
              <div className="rounded-xl border bg-card p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </h2>
                <Separator className="my-4" />
                <dl className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <dt className="text-sm text-muted-foreground">Email</dt>
                      <dd className="font-medium">{organization.email}</dd>
                    </div>
                  </div>
                  {organization.contactPerson && (
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <dt className="text-sm text-muted-foreground">Contact Person</dt>
                        <dd className="font-medium">{organization.contactPerson}</dd>
                      </div>
                    </div>
                  )}
                  {organization.contactPhone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <dt className="text-sm text-muted-foreground">Phone</dt>
                        <dd className="font-medium">{organization.contactPhone}</dd>
                      </div>
                    </div>
                  )}
                  {organization.website && (
                    <div className="flex items-start gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <dt className="text-sm text-muted-foreground">Website</dt>
                        <dd>
                          <a
                            href={organization.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {organization.website}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </dd>
                      </div>
                    </div>
                  )}
                </dl>
              </div>

              {/* Organization Details */}
              <div className="rounded-xl border bg-card p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization Details
                </h2>
                <Separator className="my-4" />
                <dl className="space-y-4">
                  {organization.industry && (
                    <div className="flex items-start gap-3">
                      <Briefcase className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <dt className="text-sm text-muted-foreground">Industry</dt>
                        <dd className="font-medium">{organization.industry}</dd>
                      </div>
                    </div>
                  )}
                  {organization.country && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <dt className="text-sm text-muted-foreground">Country</dt>
                        <dd className="font-medium">{organization.country}</dd>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <dt className="text-sm text-muted-foreground">Registered</dt>
                      <dd className="font-medium">{format(new Date(organization.createdAt), "MMMM d, yyyy")}</dd>
                    </div>
                  </div>
                  {organization.approvedAt && (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mt-1" />
                      <div>
                        <dt className="text-sm text-muted-foreground">Approved</dt>
                        <dd className="font-medium">{format(new Date(organization.approvedAt), "MMMM d, yyyy")}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              </div>

              {/* Description */}
              {organization.description && (
                <div className="rounded-xl border bg-card p-6 lg:col-span-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Description
                  </h2>
                  <Separator className="my-4" />
                  <p className="text-muted-foreground whitespace-pre-wrap">{organization.description}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="briefs" className="mt-6">
            {briefs.length === 0 ? (
              <div className="rounded-xl border bg-card p-12 text-center">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No briefs submitted</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This organization hasn't submitted any briefs yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {briefs.map((brief) => {
                  const briefConfig = briefStatusConfig[brief.status] || { label: brief.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <div key={brief.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/portal/briefs/${brief.id}`}
                              className="font-medium text-lg hover:underline"
                            >
                              {brief.title}
                            </Link>
                            <Badge className={briefConfig.color}>{briefConfig.label}</Badge>
                          </div>
                          {brief.vertical && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Vertical: {brief.vertical.name}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {brief.description}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{brief.teamsCount}/{brief.maxTeams} teams</p>
                          {brief.submittedAt && (
                            <p className="mt-1">Submitted {format(new Date(brief.submittedAt), "MMM d, yyyy")}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <div className="rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="font-medium">Organization registered</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(organization.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                {organization.approvedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Organization approved</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(organization.approvedAt), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                )}
                {organization.status === "rejected" && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Organization rejected</p>
                      <p className="text-sm text-muted-foreground">
                        {organization.rejectionReason}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Organization</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting "{organization.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Textarea
                placeholder="Explain why this organization is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update the organization's information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  value={editForm.industry || ""}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={editForm.country || ""}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input
                value={editForm.contactPerson || ""}
                onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={editForm.contactPhone || ""}
                onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={editForm.website || ""}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                placeholder="https://"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="staff">
      <OrganizationDetailContent id={id} />
    </ProtectedRoute>
  );
}
