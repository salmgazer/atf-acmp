"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminRemovalRequests,
  useApproveRemovalRequest,
  useRejectRemovalRequest,
  type AdminMemberRemovalRequest,
} from "@/lib/api/hooks/use-teams";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  ArrowLeft,
  Users,
  UserMinus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

function RemovalRequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: AdminMemberRemovalRequest;
  onApprove: (request: AdminMemberRemovalRequest) => void;
  onReject: (request: AdminMemberRemovalRequest) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header with Team & Member */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/portal/teams/${request.teamId}`}
              className="font-semibold text-foreground hover:text-primary hover:underline"
            >
              {request.team?.name || "Unknown Team"}
            </Link>
            <Badge variant="outline" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />
              {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
            </Badge>
          </div>

          {/* Member being removed */}
          <div className="mt-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Remove:{" "}
                <Link
                  href={`/portal/participants/${request.participantId}`}
                  className="text-foreground hover:text-primary hover:underline"
                >
                  {request.participant?.firstName} {request.participant?.lastName}
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">{request.participant?.email}</p>
            </div>
          </div>

          {/* Requested by */}
          <div className="mt-3 text-sm text-muted-foreground">
            <span>Requested by: </span>
            <span className="font-medium text-foreground">
              {request.requester?.firstName} {request.requester?.lastName}
            </span>
            <span className="text-muted-foreground"> (Team Lead)</span>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50">
              <p className="text-sm font-medium text-muted-foreground mb-1">Reason:</p>
              <p className="text-sm text-foreground">{request.reason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => onApprove(request)}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject(request)}>
            <XCircle className="mr-1.5 h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function RemovalRequestsContent() {
  const { user } = useAuthStore();
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Dialog state
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AdminMemberRemovalRequest | null>(null);
  const [notes, setNotes] = useState("");

  // Global cohort from sidebar
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  // Initialize from global cohort
  useEffect(() => {
    if (globalCohortId && !hasInitialized) {
      setSelectedCohortId(null);
      setHasInitialized(true);
    }
  }, [globalCohortId, hasInitialized]);

  const effectiveCohortId = selectedCohortId ?? globalCohortId ?? undefined;

  const { data: requests, isLoading } = useAdminRemovalRequests(effectiveCohortId);
  const approveMutation = useApproveRemovalRequest();
  const rejectMutation = useRejectRemovalRequest();

  const handleApproveClick = (request: AdminMemberRemovalRequest) => {
    setSelectedRequest(request);
    setNotes("");
    setShowApproveDialog(true);
  };

  const handleRejectClick = (request: AdminMemberRemovalRequest) => {
    setSelectedRequest(request);
    setNotes("");
    setShowRejectDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user) return;
    await approveMutation.mutateAsync({
      requestId: selectedRequest.id,
      resolvedBy: user.id,
      notes: notes || undefined,
    });
    setShowApproveDialog(false);
    setSelectedRequest(null);
  };

  const handleReject = async () => {
    if (!selectedRequest || !user) return;
    await rejectMutation.mutateAsync({
      requestId: selectedRequest.id,
      resolvedBy: user.id,
      notes: notes || undefined,
    });
    setShowRejectDialog(false);
    setSelectedRequest(null);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/portal/teams">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Member Removal Requests</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve removal requests from team leads
            </p>
          </div>
        </div>

        {/* Cohort Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Cohort:</span>
            <select
              value={selectedCohortId ?? globalCohortId ?? ""}
              onChange={(e) => setSelectedCohortId(e.target.value || null)}
              className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
            >
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </option>
              ))}
            </select>
          </div>
          {requests && requests.length > 0 && (
            <Badge variant="secondary">
              {requests.length} pending request{requests.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">No pending requests</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              All member removal requests have been processed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <RemovalRequestCard
                key={request.id}
                request={request}
                onApprove={handleApproveClick}
                onReject={handleRejectClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Removal Request</DialogTitle>
            <DialogDescription>
              This will remove{" "}
              <span className="font-medium">
                {selectedRequest?.participant?.firstName} {selectedRequest?.participant?.lastName}
              </span>{" "}
              from{" "}
              <span className="font-medium">{selectedRequest?.team?.name}</span>. The member will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This action cannot be undone. The removed participant will need to find a new team.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about this decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Removal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Removal Request</DialogTitle>
            <DialogDescription>
              This will reject the request to remove{" "}
              <span className="font-medium">
                {selectedRequest?.participant?.firstName} {selectedRequest?.participant?.lastName}
              </span>{" "}
              from{" "}
              <span className="font-medium">{selectedRequest?.team?.name}</span>. The member will
              remain on the team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for rejection (recommended)</Label>
              <Textarea
                placeholder="Explain why this request is being rejected..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function RemovalRequestsPage() {
  return (
    <ProtectedRoute portal="staff">
      <RemovalRequestsContent />
    </ProtectedRoute>
  );
}
