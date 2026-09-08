"use client";

import { use, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  useSubmitBrief,
  useDeleteBrief,
  useUploadBriefVideoForExisting,
  type BriefStatus,
} from "@/lib/api/hooks/use-briefs";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Send,
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
  TrendingUp,
  Award,
  GitBranch,
  Video,
  Upload,
  Play,
} from "lucide-react";

const statusConfig: Record<BriefStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle; color: string }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock, color: "text-muted-foreground" },
  submitted: { label: "Submitted", variant: "default", icon: Clock, color: "text-blue-600" },
  in_review: { label: "In Review", variant: "default", icon: Clock, color: "text-blue-600" },
  approved: { label: "Approved", variant: "default", icon: CheckCircle, color: "text-green-600" },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle, color: "text-red-600" },
  revision_requested: { label: "Revision Needed", variant: "outline", icon: AlertCircle, color: "text-yellow-600" },
};

function BriefDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: brief, isLoading, error } = useBrief(id);
  const submitMutation = useSubmitBrief();
  const deleteMutation = useDeleteBrief();
  const uploadVideoMutation = useUploadBriefVideoForExisting();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <OrganizationLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OrganizationLayout>
    );
  }

  if (error || !brief) {
    return (
      <OrganizationLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Brief not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/org/briefs">Back to Briefs</Link>
          </Button>
        </div>
      </OrganizationLayout>
    );
  }

  const config = statusConfig[brief.status];
  const StatusIcon = config.icon;
  const canEdit = ["draft", "revision_requested"].includes(brief.status);
  const canSubmit = ["draft", "revision_requested"].includes(brief.status);
  const canDelete = brief.status === "draft";

  const handleSubmit = async () => {
    await submitMutation.mutateAsync({ id });
    setShowSubmitDialog(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    router.push("/org/briefs");
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a valid video file (MP4, WebM, or MOV)");
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Video file is too large. Maximum size is 100MB.");
      return;
    }

    setIsUploadingVideo(true);
    try {
      await uploadVideoMutation.mutateAsync({ id, file });
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  };

  return (
    <OrganizationLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/org/briefs">
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
                Created {format(new Date(brief.createdAt), "MMM d, yyyy")} • 
                Updated {formatDistanceToNow(new Date(brief.updatedAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canSubmit && (
              <Button onClick={() => setShowSubmitDialog(true)}>
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </Button>
            )}
            {canEdit && (
              <Button asChild variant="outline">
                <Link href={`/org/briefs/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Revision Feedback */}
        {brief.status === "revision_requested" && brief.reviewFeedback && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="h-5 w-5" />
              <h2 className="font-semibold">Revision Requested</h2>
            </div>
            <p className="mt-2 text-yellow-700 dark:text-yellow-300">{brief.reviewFeedback}</p>
            {brief.reviewedAt && (
              <p className="mt-2 text-sm text-yellow-600">
                Feedback provided on {format(new Date(brief.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
        )}

        {/* Rejection Reason */}
        {brief.status === "rejected" && brief.reviewFeedback && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <XCircle className="h-5 w-5" />
              <h2 className="font-semibold">Brief Rejected</h2>
            </div>
            <p className="mt-2 text-red-700 dark:text-red-300">{brief.reviewFeedback}</p>
          </div>
        )}

        {/* Stage B: Video Pitch - Only shown after approval */}
        {brief.status === "approved" && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Stage B: Video Pitch</h2>
                <p className="text-sm text-muted-foreground">
                  Your written brief has been approved! Upload a video pitch to help teams understand your challenge better.
                </p>
              </div>
            </div>

            {brief.videoUrl ? (
              <div className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Video uploaded successfully</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-replace"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={isUploadingVideo}
                    >
                      {isUploadingVideo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Replace Video
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Video className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No video uploaded yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Upload a video pitch (MP4, WebM, or MOV, max 100MB) to showcase your challenge to participating teams.
                </p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <Button
                  className="mt-4"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isUploadingVideo}
                >
                  {isUploadingVideo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isUploadingVideo ? "Uploading..." : "Upload Video"}
                </Button>
              </div>
            )}
          </div>
        )}

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

            {/* Teams Progress Section - Only shown for approved briefs */}
            {brief.status === "approved" && brief.teamsCount > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Assigned Teams ({brief.teamsCount})
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Teams working on your brief and their current progress
                </p>
                
                {/* Placeholder for teams - will be populated when teams API is connected */}
                <div className="space-y-3">
                  {/* Demo team cards - replace with actual data */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">Team progress tracking</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Team names and progress will appear here once teams are assigned to your brief
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state when approved but no teams yet */}
            {brief.status === "approved" && brief.teamsCount === 0 && (
              <div className="rounded-lg border bg-card p-6">
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No Teams Assigned Yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    Your brief has been approved and is available for teams to select.
                    You'll see team progress here once participants are matched to your brief.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                  <dt className="text-sm text-muted-foreground">Revision Count</dt>
                  <dd className="font-medium">{brief.revisionCount}</dd>
                </div>
                {brief.submittedAt && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Submitted</dt>
                    <dd className="font-medium">{format(new Date(brief.submittedAt), "MMM d, yyyy")}</dd>
                  </div>
                )}
                {brief.approvedAt && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Approved</dt>
                    <dd className="font-medium">{format(new Date(brief.approvedAt), "MMM d, yyyy")}</dd>
                  </div>
                )}
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

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Brief for Review</DialogTitle>
            <DialogDescription>
              Your brief will be submitted for review by the ATF team. You won't be able to edit it until the review is complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Brief</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{brief.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrganizationLayout>
  );
}

export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="organization">
      <BriefDetailContent id={id} />
    </ProtectedRoute>
  );
}
