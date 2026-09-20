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
  useRestoreBriefRevision,
  type BriefStatus,
  type BriefRevision,
} from "@/lib/api/hooks/use-briefs";
import { useAuthStore } from "@/lib/stores/auth-store";
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
  Pencil,
  Eye,
  User,
  Building,
  Bot,
  Image,
  Download,
} from "lucide-react";

const statusConfig: Record<BriefStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  submitted: { label: "Submitted", variant: "default", icon: Clock },
  in_review: { label: "In Review", variant: "default", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  revision_requested: { label: "Revision Requested", variant: "outline", icon: AlertCircle },
};

const actionConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  submitted: { label: "Submitted", variant: "default", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  revision_requested: { label: "Revision Requested", variant: "outline", icon: AlertCircle },
  updated: { label: "Updated", variant: "secondary", icon: Pencil },
  restored: { label: "Restored", variant: "outline", icon: RotateCcw },
};

const actorTypeConfig: Record<string, { label: string; icon: typeof User }> = {
  organization: { label: "Organization", icon: Building },
  staff: { label: "Staff", icon: User },
  system: { label: "System", icon: Bot },
};

function BriefReviewContent({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: brief, isLoading, error } = useBrief(id);
  const { data: revisions } = useBriefRevisions(id);
  const startReviewMutation = useStartBriefReview();
  const reviewMutation = useReviewBrief();
  const restoreMutation = useRestoreBriefRevision();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showRevisionDetailDialog, setShowRevisionDetailDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<BriefRevision | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [restoreComment, setRestoreComment] = useState("");

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

  const handleViewRevision = (revision: BriefRevision) => {
    setSelectedRevision(revision);
    setShowRevisionDetailDialog(true);
  };

  const handleOpenRestoreDialog = (revision: BriefRevision) => {
    setSelectedRevision(revision);
    setRestoreComment("");
    setShowRestoreDialog(true);
  };

  const handleRestore = async () => {
    if (!selectedRevision || !user) return;
    
    await restoreMutation.mutateAsync({
      briefId: id,
      revisionId: selectedRevision.id,
      actorId: user.id,
      actorName: `${user.firstName} ${user.lastName}`,
      comment: restoreComment || undefined,
    });
    setShowRestoreDialog(false);
    setSelectedRevision(null);
    setRestoreComment("");
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

          {/* Edit button - always available for staff */}
          <Button asChild variant="outline">
            <Link href={`/portal/briefs/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Brief
            </Link>
          </Button>
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

            {/* Image Gallery Section */}
            {brief.imageUrls && brief.imageUrls.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Image className="h-5 w-5" />
                  Image Gallery ({brief.imageUrls.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {brief.imageUrls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(url)}
                      className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <img
                        src={url}
                        alt={`Gallery image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Revision History */}
            {revisions && revisions.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <History className="h-5 w-5" />
                  Revision History
                </h2>
                <div className="space-y-3">
                  {revisions.map((revision) => {
                    const actionConf = actionConfig[revision.action] || { label: revision.action, variant: "secondary" as const, icon: Clock };
                    const ActionIcon = actionConf.icon;
                    const actorConf = revision.actorType ? actorTypeConfig[revision.actorType] : null;
                    const ActorIcon = actorConf?.icon || User;
                    const canRestore = revision.previousData && Object.keys(revision.previousData).length > 0;

                    return (
                      <div
                        key={revision.id}
                        className="flex gap-4 p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={actionConf.variant} className="text-xs">
                              <ActionIcon className="mr-1 h-3 w-3" />
                              {actionConf.label}
                            </Badge>
                            {revision.version && (
                              <span className="text-xs text-muted-foreground">
                                v{revision.version}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(revision.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          {/* Actor info */}
                          {(revision.actorName || revision.actorType) && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <ActorIcon className="h-3 w-3" />
                              <span>
                                {revision.actorName || "Unknown"} 
                                {actorConf && <span className="text-muted-foreground/70"> ({actorConf.label})</span>}
                              </span>
                            </div>
                          )}
                          {revision.comment && (
                            <p className="mt-2 text-sm">{revision.comment}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          {(revision.previousData || revision.newData) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewRevision(revision)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {canRestore && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRestoreDialog(revision)}
                              title="Restore to this version"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

            {/* AI-Challenge Fit Scoring */}
            {(brief.fitScore !== undefined || brief.priorityScore !== undefined) && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="font-semibold mb-4">AI-Challenge Fit</h2>
                <dl className="space-y-4">
                  {brief.priorityScore !== undefined && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Priority Score</dt>
                      <dd className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
                          brief.priorityScore >= 140 ? "bg-emerald-500/15 text-emerald-600" :
                          brief.priorityScore >= 100 ? "bg-blue-500/15 text-blue-600" :
                          brief.priorityScore >= 50 ? "bg-amber-500/15 text-amber-600" :
                          "bg-red-500/15 text-red-600"
                        }`}>
                          {brief.priorityScore}
                        </span>
                        <span className="text-xs text-muted-foreground">/ 190</span>
                      </dd>
                    </div>
                  )}
                  {brief.fitScore !== undefined && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Fit Score</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-medium">{brief.fitScore}</span>
                        <span className="text-xs text-muted-foreground">/ 100</span>
                        {brief.fitBand && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {brief.fitBand.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </dd>
                    </div>
                  )}
                  {brief.impactScore !== undefined && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Impact Score</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-medium">{brief.impactScore}</span>
                        <span className="text-xs text-muted-foreground">/ 9</span>
                        {brief.impactBand && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {brief.impactBand.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </dd>
                    </div>
                  )}
                  {brief.scoreOverride && (
                    <div className="mt-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                            {brief.scoreOverride}
                          </p>
                          <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                            This opportunity may need groundwork before it&apos;s ready for an AI solution.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </dl>
              </div>
            )}

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

      {/* Revision Detail Dialog */}
      <Dialog open={showRevisionDetailDialog} onOpenChange={setShowRevisionDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Revision Details
              {selectedRevision?.version && (
                <Badge variant="outline">v{selectedRevision.version}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedRevision && format(new Date(selectedRevision.createdAt), "MMMM d, yyyy 'at' h:mm a")}
              {selectedRevision?.actorName && ` by ${selectedRevision.actorName}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRevision && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Badge variant={actionConfig[selectedRevision.action]?.variant || "secondary"}>
                  {actionConfig[selectedRevision.action]?.label || selectedRevision.action}
                </Badge>
                {selectedRevision.actorType && (
                  <Badge variant="outline" className="text-xs">
                    {actorTypeConfig[selectedRevision.actorType]?.label || selectedRevision.actorType}
                  </Badge>
                )}
              </div>

              {selectedRevision.comment && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium mb-1">Comment</p>
                  <p className="text-sm text-muted-foreground">{selectedRevision.comment}</p>
                </div>
              )}

              {selectedRevision.previousData && Object.keys(selectedRevision.previousData).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Previous State (Before Change)</p>
                  <div className="space-y-2">
                    {Object.entries(selectedRevision.previousData).map(([key, value]) => (
                      <div key={key} className="rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground capitalize mb-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <div className="text-sm">
                          {typeof value === 'string' && value.includes('<') ? (
                            <div 
                              className="prose prose-sm max-w-none dark:prose-invert line-clamp-3"
                              dangerouslySetInnerHTML={{ __html: value }} 
                            />
                          ) : Array.isArray(value) ? (
                            <div className="flex flex-wrap gap-1">
                              {value.map((item, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {typeof item === 'object' ? item.name || JSON.stringify(item) : item}
                                </Badge>
                              ))}
                            </div>
                          ) : typeof value === 'object' && value !== null ? (
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : (
                            <span>{String(value)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRevision.newData && Object.keys(selectedRevision.newData).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">New State (After Change)</p>
                  <div className="space-y-2">
                    {Object.entries(selectedRevision.newData).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20 p-3">
                        <p className="text-xs font-medium text-muted-foreground capitalize mb-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <div className="text-sm">
                          {typeof value === 'string' && value.includes('<') ? (
                            <div 
                              className="prose prose-sm max-w-none dark:prose-invert line-clamp-3"
                              dangerouslySetInnerHTML={{ __html: value }} 
                            />
                          ) : Array.isArray(value) ? (
                            <div className="flex flex-wrap gap-1">
                              {value.map((item, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {typeof item === 'object' ? item.name || JSON.stringify(item) : item}
                                </Badge>
                              ))}
                            </div>
                          ) : typeof value === 'object' && value !== null ? (
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : (
                            <span>{String(value)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDetailDialog(false)}>
              Close
            </Button>
            {selectedRevision?.previousData && Object.keys(selectedRevision.previousData).length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowRevisionDetailDialog(false);
                  handleOpenRestoreDialog(selectedRevision);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore This Version
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Previous Version</DialogTitle>
            <DialogDescription>
              This will restore the brief to the state before version {selectedRevision?.version} was created.
              A new revision will be created to track this restoration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    This action will overwrite the current content
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                    The current state will be saved in the revision history, so you can restore it later if needed.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Restore Comment (optional)</Label>
              <Textarea
                placeholder="Why are you restoring this version?"
                value={restoreComment}
                onChange={(e) => setRestoreComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={restoreMutation.isPending}>
              {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restore Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Gallery preview"
                className="w-full h-auto max-h-[80vh] object-contain bg-black"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (selectedImage) {
                      window.open(selectedImage, '_blank');
                    }
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          </div>
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
