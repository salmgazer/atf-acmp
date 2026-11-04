"use client";

import { useState, useEffect } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { useStages } from "@/lib/api/hooks/use-stages";
import {
  usePendingApprovalSubmissions,
  useApproveSubmission,
  useRejectSubmission,
  AdminSubmission,
} from "@/lib/api/hooks/use-submissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Loader2,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  Github,
  Video,
  Clock,
  AlertCircle,
  Eye,
  Download,
  Calendar,
  FileIcon,
  MoreHorizontal,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function SubmissionsReviewPage() {
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<AdminSubmission | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Get global cohort from store (set by sidebar)
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);
  
  const { data: cohortsData, isLoading: cohortsLoading } = useCohorts();
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
  
  const { data: stages, isLoading: stagesLoading } = useStages(effectiveCohortId);
  
  // Filter to stages that require manual approval
  const approvalStages = stages?.filter((s) => s.requiresManualApproval) || [];

  const { data: submissionsData, isLoading: submissionsLoading } = usePendingApprovalSubmissions({
    stageId: selectedStageId || undefined,
    cohortId: effectiveCohortId,
    status: statusFilter || undefined,
  });

  const approveMutation = useApproveSubmission();
  const rejectMutation = useRejectSubmission();

  const handleApproveClick = (submission: AdminSubmission) => {
    setSelectedSubmission(submission);
    setApprovalNotes("");
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (submission: AdminSubmission) => {
    setSelectedSubmission(submission);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleViewClick = (submission: AdminSubmission) => {
    setSelectedSubmission(submission);
    setViewDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedSubmission) return;
    await approveMutation.mutateAsync({
      id: selectedSubmission.id,
      approvalNotes: approvalNotes || undefined,
    });
    setApproveDialogOpen(false);
    setSelectedSubmission(null);
  };

  const handleConfirmReject = async () => {
    if (!selectedSubmission || !rejectionReason.trim()) return;
    await rejectMutation.mutateAsync({
      id: selectedSubmission.id,
      rejectionReason: rejectionReason.trim(),
    });
    setRejectDialogOpen(false);
    setSelectedSubmission(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="text-red-600 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "late":
        return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const submissions = submissionsData?.submissions || [];

  const columns = [
    {
      key: "team",
      header: "Team",
      render: (_: unknown, row: AdminSubmission) => (
        <div className="font-medium">{row.team?.name || "Unknown Team"}</div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      render: (_: unknown, row: AdminSubmission) => (
        <div className="text-sm text-muted-foreground">{row.stage?.name || "Unknown Stage"}</div>
      ),
    },
    {
      key: "content",
      header: "Content",
      render: (_: unknown, row: AdminSubmission) => (
        <div className="flex flex-wrap gap-1">
          {row.fileUrls && row.fileUrls.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              {row.fileUrls.length} file{row.fileUrls.length > 1 ? "s" : ""}
            </Badge>
          )}
          {row.team?.githubRepoUrl && (
            <Badge variant="secondary" className="text-xs">
              <Github className="h-3 w-3 mr-1" />
              GitHub
            </Badge>
          )}
          {row.videoUrl && (
            <Badge variant="secondary" className="text-xs">
              <Video className="h-3 w-3 mr-1" />
              Video
            </Badge>
          )}
          {!row.fileUrls?.length && !row.team?.githubRepoUrl && !row.videoUrl && row.content?.textContent && (
            <Badge variant="secondary" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Text
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "submittedAt",
      header: "Submitted",
      render: (_: unknown, row: AdminSubmission) => (
        <div className="text-sm text-muted-foreground">
          {row.submittedAt ? formatDistanceToNow(new Date(row.submittedAt), { addSuffix: true }) : "N/A"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_: unknown, row: AdminSubmission) => (
        <div className="flex items-center gap-2">
          {getStatusBadge(row.status)}
          {row.isLate && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">Late</Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (_: unknown, row: AdminSubmission) => {
        const canReview = row.status === "pending_approval" || row.status === "late";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewClick(row)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {canReview && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleApproveClick(row)}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRejectClick(row)}>
                    <XCircle className="mr-2 h-4 w-4 text-red-600" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <ProtectedRoute portal="staff">
      <StaffLayout>
        <div className="container py-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Submission Review</h1>
            <p className="text-muted-foreground">
              Review and approve team submissions for stages that require manual approval
            </p>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Cohort</Label>
                  {cohortsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Select 
                      value={selectedCohortId ?? globalCohortId ?? ""} 
                      onValueChange={(v) => {
                        setSelectedCohortId(v || null);
                        setSelectedStageId(""); // Reset stage when cohort changes
                      }}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Select cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        {cohorts.map((cohort) => (
                          <SelectItem key={cohort.id} value={cohort.id}>
                            {cohort.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Stage (Requires Approval)</Label>
                  <Select 
                    value={selectedStageId} 
                    onValueChange={setSelectedStageId}
                    disabled={!effectiveCohortId || stagesLoading}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="All approval stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All approval stages</SelectItem>
                      {approvalStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          Stage {stage.number}: {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="pending_approval">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          {cohortsLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          ) : !effectiveCohortId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No Active Cohort</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  There is no active cohort. Please activate a cohort to review submissions.
                </p>
              </CardContent>
            </Card>
          ) : approvalStages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No Approval Stages</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  This cohort has no stages configured to require manual approval.
                  You can enable this in the stage settings.
                </p>
              </CardContent>
            </Card>
          ) : submissions.length === 0 && !submissionsLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-1">All Caught Up!</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {statusFilter === "pending_approval" 
                    ? "There are no submissions pending your approval."
                    : `No submissions found with status "${statusFilter || "any"}".`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <DataTableCard
              columns={columns}
              data={submissions}
              loading={submissionsLoading}
              emptyMessage="No submissions found"
            />
          )}

          {submissionsData && submissions.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {submissions.length} of {submissionsData.total} submissions
            </p>
          )}
        </div>

        {/* Approve Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Submission</DialogTitle>
              <DialogDescription>
                Approve this submission from {selectedSubmission?.team?.name || "the team"} for {selectedSubmission?.stage?.name || "this stage"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Approval Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes for the team..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmApprove} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Submission</DialogTitle>
              <DialogDescription>
                Reject this submission from {selectedSubmission?.team?.name || "the team"}. Please provide a reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rejection Reason (Required)</Label>
                <Textarea
                  placeholder="Explain why this submission is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmReject} 
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Full Submission Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span>Submission Details</span>
                {selectedSubmission && getStatusBadge(selectedSubmission.status)}
              </DialogTitle>
              <DialogDescription>
                {selectedSubmission?.team?.name || "Team"} • {selectedSubmission?.stage?.name || "Stage"}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[calc(90vh-200px)]">
              {selectedSubmission && (
                <div className="space-y-6 pr-4">
                  {/* Submission Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Submitted:</span>
                      <span>
                        {selectedSubmission.submittedAt 
                          ? format(new Date(selectedSubmission.submittedAt), "PPp")
                          : "Not yet submitted"}
                      </span>
                    </div>
                    {selectedSubmission.isLate && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-orange-600">
                          Late by {selectedSubmission.lateMinutes} minutes
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Text Content */}
                  {selectedSubmission.content?.textContent && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Written Content
                      </h4>
                      <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                        {selectedSubmission.content.textContent}
                      </div>
                    </div>
                  )}

                  {/* Additional Content Fields */}
                  {selectedSubmission.content && Object.keys(selectedSubmission.content).filter(k => k !== 'textContent').length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Additional Fields</h4>
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        {Object.entries(selectedSubmission.content)
                          .filter(([key]) => key !== 'textContent')
                          .map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-muted-foreground capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                              </span>{" "}
                              <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Files */}
                  {selectedSubmission.fileUrls && selectedSubmission.fileUrls.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileIcon className="h-4 w-4" />
                        Attached Files ({selectedSubmission.fileUrls.length})
                      </h4>
                      <div className="grid gap-2">
                        {selectedSubmission.fileUrls.map((file, idx) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-blue-500" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.type} • {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GitHub Link - from team */}
                  {selectedSubmission.team?.githubRepoUrl && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        Team GitHub Repository
                      </h4>
                      <a
                        href={selectedSubmission.team.githubRepoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm"
                      >
                        <Github className="h-5 w-5" />
                        <span className="flex-1 truncate">{selectedSubmission.team.githubRepoUrl}</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </div>
                  )}

                  {/* Video */}
                  {selectedSubmission.videoUrl && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Video Submission
                      </h4>
                      <div className="bg-muted/50 rounded-lg overflow-hidden">
                        <video
                          src={selectedSubmission.videoUrl}
                          controls
                          className="w-full max-h-[400px]"
                          preload="metadata"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                      <a
                        href={selectedSubmission.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open video in new tab
                      </a>
                    </div>
                  )}

                  <Separator />

                  {/* Status History / Notes */}
                  {(selectedSubmission.rejectionReason || selectedSubmission.approvalNotes) && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Review Notes</h4>
                      {selectedSubmission.status === "rejected" && selectedSubmission.rejectionReason && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Rejection Reason</p>
                          <p className="text-sm text-red-600 dark:text-red-400">{selectedSubmission.rejectionReason}</p>
                          {selectedSubmission.rejectedAt && (
                            <p className="text-xs text-red-500 mt-2">
                              Rejected on {format(new Date(selectedSubmission.rejectedAt), "PPp")}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedSubmission.status === "approved" && selectedSubmission.approvalNotes && (
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Approval Notes</p>
                          <p className="text-sm text-green-600 dark:text-green-400">{selectedSubmission.approvalNotes}</p>
                          {selectedSubmission.approvedAt && (
                            <p className="text-xs text-green-500 mt-2">
                              Approved on {format(new Date(selectedSubmission.approvedAt), "PPp")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
              {(selectedSubmission?.status === "pending_approval" || selectedSubmission?.status === "late") && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewDialogOpen(false);
                      handleRejectClick(selectedSubmission);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setViewDialogOpen(false);
                      handleApproveClick(selectedSubmission);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaffLayout>
    </ProtectedRoute>
  );
}
