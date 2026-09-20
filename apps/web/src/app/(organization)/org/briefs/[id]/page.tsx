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
  useUploadBriefImage,
  useRemoveBriefImage,
  type BriefStatus,
} from "@/lib/api/hooks/use-briefs";
import { useTeams, type Team } from "@/lib/api/hooks/use-teams";
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
  Image,
  X,
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
  const uploadImageMutation = useUploadBriefImage();
  const removeImageMutation = useRemoveBriefImage();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<number | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch teams assigned to this brief
  const { data: teamsData, isLoading: isLoadingTeams } = useTeams({
    briefId: id,
    limit: 100,
  });

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a valid image file (PNG or JPG)");
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Image file is too large. Maximum size is 10MB.");
      return;
    }

    setIsUploadingImage(true);
    try {
      await uploadImageMutation.mutateAsync({ id, file });
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleImageDelete = async () => {
    if (imageToDelete === null) return;
    await removeImageMutation.mutateAsync({ id, index: imageToDelete });
    setImageToDelete(null);
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

            {/* Image Gallery Section */}
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Image Gallery</h3>
                  <span className="text-sm text-muted-foreground">
                    ({brief.imageUrls?.length || 0}/10)
                  </span>
                </div>
                {(brief.imageUrls?.length || 0) < 10 && (
                  <>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Add Image
                    </Button>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Add images to showcase your organization and challenge context (PNG or JPG, max 10MB each).
              </p>
              
              {brief.imageUrls && brief.imageUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {brief.imageUrls.map((url, index) => (
                    <div key={index} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={url}
                        alt={`Gallery image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setImageToDelete(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Image className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No images uploaded yet
                  </p>
                </div>
              )}
            </div>
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
                  <Link
                    href={`/org/teams?briefId=${id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View all teams
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Teams working on your brief
                </p>
                
                {isLoadingTeams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamsData?.data.map((team) => (
                      <div key={team.id} className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{team.name}</h3>
                              <Badge variant={team.status === "active" ? "default" : "secondary"} className="text-xs">
                                {team.status}
                              </Badge>
                            </div>
                            {team.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {team.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                              </span>
                              {team.mentor && (
                                <span className="flex items-center gap-1">
                                  <Award className="h-3 w-3" />
                                  Mentor: {team.mentor.firstName} {team.mentor.lastName}
                                </span>
                              )}
                              {team.githubRepoUrl && (
                                <a
                                  href={team.githubRepoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:text-foreground"
                                >
                                  <GitBranch className="h-3 w-3" />
                                  Repository
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Team Members */}
                        {team.members && team.members.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex flex-wrap gap-2">
                              {team.members.slice(0, 5).map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded-full bg-background text-xs"
                                >
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                                    {member.participant.firstName?.[0]}{member.participant.lastName?.[0]}
                                  </div>
                                  <span>{member.participant.firstName} {member.participant.lastName}</span>
                                  {member.role === "lead" && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">Lead</Badge>
                                  )}
                                </div>
                              ))}
                              {team.members.length > 5 && (
                                <div className="flex items-center px-2 py-1 text-xs text-muted-foreground">
                                  +{team.members.length - 5} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state when approved but no teams yet */}
            {brief.status === "approved" && brief.teamsCount === 0 && (
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Assigned Teams
                  </h2>
                  <Link
                    href={`/org/teams?briefId=${id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View teams page
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
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
                          <TrendingUp className="h-3 w-3" />
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

      {/* Image Delete Dialog */}
      <Dialog open={imageToDelete !== null} onOpenChange={(open) => !open && setImageToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this image from the gallery?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleImageDelete} disabled={removeImageMutation.isPending}>
              {removeImageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
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
