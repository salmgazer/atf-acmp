"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  useBrief,
  useBriefRevisions,
  useStartBriefReview,
  useReviewBrief,
  type BriefStatus,
} from "@/lib/api/hooks/use-briefs";
import {
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Users,
  Calendar,
  Tag,
  FileText,
  Building2,
  History,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Video,
} from "lucide-react";

const statusConfig: Record<BriefStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  submitted: { label: "Submitted", variant: "default", icon: Clock },
  in_review: { label: "In Review", variant: "default", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  revision_requested: { label: "Revision Requested", variant: "outline", icon: AlertCircle },
};

function BriefReviewContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: brief, isLoading, error } = useBrief(id);
  const { data: revisions } = useBriefRevisions(id);
  const startReviewMutation = useStartBriefReview();
  const reviewMutation = useReviewBrief();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !brief) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Brief not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/briefs">Back to Briefs</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const config = statusConfig[brief.status];
  const StatusIcon = config.icon;
  const canReview = ["submitted", "in_review"].includes(brief.status);

  const handleStartReview = async () => {
    await startReviewMutation.mutateAsync({ id });
  };

  const handleApprove = async () => {
    await reviewMutation.mutateAsync({
      id,
      data: { action: "approved", feedback },
    });
    setShowApproveDialog(false);
    setFeedback("");
  };

  const handleReject = async () => {
    await reviewMutation.mutateAsync({
      id,
      data: { action: "rejected", feedback },
    });
    setShowRejectDialog(false);
    setFeedback("");
  };

  const handleRequestRevision = async () => {
    await reviewMutation.mutateAsync({
      id,
      data: { action: "revision_requested", feedback },
    });
    setShowRevisionDialog(false);
    setFeedback("");
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/portal/briefs">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{brief.title}</h1>
                <Badge variant={config.variant}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Submitted by {brief.organization?.name || "Unknown Organization"}
              </p>
            </div>
          </div>

          {canReview && (
            <div className="flex items-center gap-2">
              {brief.status === "submitted" && (
                <Button
                  variant="outline"
                  onClick={handleStartReview}
                  disabled={startReviewMutation.isPending}
                >
                  {startReviewMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Start Review
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowRevisionDialog(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Request Revision
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setShowRejectDialog(true)}
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setShowApproveDialog(true)}>
                <ThumbsUp className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Description</h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: brief.description }}
              />
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Problem Statement</h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: brief.problemStatement }}
              />
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Expected Outcomes</h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: brief.expectedOutcomes }}
              />
            </div>

            {brief.resources && brief.resources.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Resources</h2>
                <div className="space-y-2">
                  {brief.resources.map((resource, index) => (
                    <a
                      key={index}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{resource.name}</span>
                      <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Video Pitch Section */}
            {brief.videoUrl && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Video className="h-5 w-5" />
                  Video Pitch
                </h2>
                <div className="rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    src={brief.videoUrl}
                    controls
                    className="w-full h-full"
                    poster={brief.imageUrls?.[0]}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            )}

            {/* Revision History */}
            {revisions && revisions.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <History className="h-5 w-5" />
                  Review History
                </h2>
                <div className="space-y-4">
                  {revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className="flex gap-4 p-3 rounded-md bg-muted/30"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {revision.action.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(revision.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        {revision.comment && (
                          <p className="mt-2 text-sm">{revision.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Organization</h2>
              <div className="flex items-center gap-3">
                {brief.organization?.logoUrl ? (
                  <img
                    src={brief.organization.logoUrl}
                    alt={brief.organization.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{brief.organization?.name}</p>
                  <Link
                    href={`/portal/organizations/${brief.organizationId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    View Organization
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Details</h2>
              <dl className="space-y-4">
                {brief.vertical && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Vertical</dt>
                    <dd className="font-medium">{brief.vertical.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Teams</dt>
                  <dd className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{brief.teamsCount} / {brief.maxTeams}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Revisions</dt>
                  <dd className="font-medium">{brief.revisionCount}</dd>
                </div>
                {brief.submittedAt && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Submitted</dt>
                    <dd className="font-medium">{format(new Date(brief.submittedAt), "MMM d, yyyy")}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="font-medium">{format(new Date(brief.createdAt), "MMM d, yyyy")}</dd>
                </div>
              </dl>
            </div>

            {brief.tags && brief.tags.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="font-semibold mb-4">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {brief.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      <Tag className="mr-1 h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Brief</DialogTitle>
            <DialogDescription>
              This brief will be approved and visible to participants for team selection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feedback (optional)</Label>
              <Textarea
                placeholder="Add any comments for the organization..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Brief</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this brief. The organization will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Textarea
                placeholder="Explain why this brief is being rejected..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
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
              onClick={handleReject}
              disabled={feedback.length < 10 || reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revision Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              The organization will be able to edit and resubmit their brief based on your feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Revision Feedback *</Label>
              <Textarea
                placeholder="Describe what changes are needed..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestRevision}
              disabled={feedback.length < 10 || reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function BriefReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="staff">
      <BriefReviewContent id={id} />
    </ProtectedRoute>
  );
}
