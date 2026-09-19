"use client";

import { useState } from "react";
import { format, isPast } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Flag,
  Loader2,
  MoreHorizontal,
  Plus,
  Settings,
  Users,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminRubrics,
  useAdminAssignments,
  useAdminReviews,
  useAssignPeerReviews,
  useDeleteStageAssignments,
  useSkipAssignment,
  useFlagReview,
  useUnflagReview,
  usePeerReviewStageStats,
  useCreateRubric,
  useDeleteRubric,
  PeerReviewAssignment,
  PeerReviewAssignmentStatus,
  PeerReview,
} from "@/lib/api/hooks/use-peer-reviews";
import { RubricForm } from "./rubric-form";

interface AdminPeerReviewsProps {
  cohortId: string;
  stages?: Array<{ id: string; name: string; number: number }>;
}

const statusConfig: Record<
  PeerReviewAssignmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  in_progress: { label: "In Progress", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  skipped: { label: "Skipped", variant: "destructive" },
};

export function AdminPeerReviews({ cohortId, stages }: AdminPeerReviewsProps) {
  const queryClient = useQueryClient();
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showRubricForm, setShowRubricForm] = useState(false);

  const { data: rubrics, isLoading: rubricsLoading } = useAdminRubrics(cohortId);
  const { data: assignmentsData, isLoading: assignmentsLoading } = useAdminAssignments({
    cohortId,
    stageId: selectedStageId || undefined,
  });
  const { data: reviews } = useAdminReviews({
    cohortId,
    stageId: selectedStageId || undefined,
  });
  const { data: stats } = usePeerReviewStageStats(
    cohortId,
    selectedStageId || null
  );

  const { mutateAsync: createRubric } = useCreateRubric();
  const { mutateAsync: deleteRubric } = useDeleteRubric();
  const { mutateAsync: assignReviews, isPending: isAssigning } = useAssignPeerReviews();
  const { mutateAsync: deleteAssignments } = useDeleteStageAssignments();
  const { mutateAsync: skipAssignment } = useSkipAssignment();
  const { mutateAsync: flagReview } = useFlagReview();
  const { mutateAsync: unflagReview } = useUnflagReview();

  const assignments = assignmentsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Peer Reviews</h2>
          <p className="text-muted-foreground">
            Manage peer review assignments and rubrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRubricForm(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Manage Rubrics
          </Button>
          <Button onClick={() => setShowAssignDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign Reviews
          </Button>
        </div>
      </div>

      {/* Stage Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>Filter by Stage:</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Stages</SelectItem>
                {stages?.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    Stage {stage.number}: {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && selectedStageId && (
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold">{stats.totalAssignments}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-primary">{stats.averageScore}%</div>
              <div className="text-sm text-muted-foreground">Avg Score</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">
            <Users className="mr-2 h-4 w-4" />
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <FileText className="mr-2 h-4 w-4" />
            Reviews ({reviews?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="rubrics">
            <Settings className="mr-2 h-4 w-4" />
            Rubrics ({rubrics?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-6">
          <AssignmentsTable
            assignments={assignments}
            isLoading={assignmentsLoading}
            onSkip={async (id) => {
              await skipAssignment(id);
              queryClient.invalidateQueries({ queryKey: ["peer-reviews", "admin", "assignments"] });
              toast.success("Assignment skipped");
            }}
          />
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <ReviewsTable
            reviews={reviews || []}
            onFlag={async (id, reason) => {
              await flagReview({ id, reason });
              queryClient.invalidateQueries({ queryKey: ["peer-reviews", "admin", "reviews"] });
              toast.success("Review flagged");
            }}
            onUnflag={async (id) => {
              await unflagReview(id);
              queryClient.invalidateQueries({ queryKey: ["peer-reviews", "admin", "reviews"] });
              toast.success("Review unflagged");
            }}
          />
        </TabsContent>

        <TabsContent value="rubrics" className="mt-6">
          <RubricsTable
            rubrics={rubrics || []}
            isLoading={rubricsLoading}
            onDelete={async (id) => {
              await deleteRubric(id);
              queryClient.invalidateQueries({ queryKey: ["peer-reviews", "admin", "rubrics"] });
              toast.success("Rubric deleted");
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Assign Dialog */}
      <AssignReviewsDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        cohortId={cohortId}
        stages={stages}
        onAssign={async (data) => {
          await assignReviews(data);
          queryClient.invalidateQueries({ queryKey: ["peer-reviews", "admin", "assignments"] });
          setShowAssignDialog(false);
          toast.success("Peer reviews assigned successfully");
        }}
        isAssigning={isAssigning}
      />

      {/* Rubric Form Dialog */}
      <Dialog open={showRubricForm} onOpenChange={setShowRubricForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Rubric</DialogTitle>
            <DialogDescription>
              Define evaluation criteria for peer reviews
            </DialogDescription>
          </DialogHeader>
          <RubricForm
            cohortId={cohortId}
            stages={stages}
            onSave={async (data) => {
              await createRubric({
                cohortId,
                stageId: data.stageId || undefined,
                name: data.name,
                description: data.description,
                criteria: data.criteria,
              });
              queryClient.invalidateQueries({ queryKey: ["peer-reviews", "admin", "rubrics"] });
              setShowRubricForm(false);
              toast.success("Rubric created successfully");
            }}
            onCancel={() => setShowRubricForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components

function AssignmentsTable({
  assignments,
  isLoading,
  onSkip,
}: {
  assignments: PeerReviewAssignment[];
  isLoading: boolean;
  onSkip: (id: string) => Promise<void>;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No assignments found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reviewer Team</TableHead>
            <TableHead>Reviewed Team</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => {
            const status = statusConfig[assignment.status];
            const isOverdue = isPast(new Date(assignment.dueDate)) && 
              assignment.status !== "completed";
            
            return (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">
                  {assignment.reviewerTeam?.name || "Unknown"}
                </TableCell>
                <TableCell>{assignment.reviewedTeam?.name || "Unknown"}</TableCell>
                <TableCell>
                  {assignment.stage ? `Stage ${assignment.stage.number}` : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className={isOverdue ? "text-destructive" : ""}>
                  {format(new Date(assignment.dueDate), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {assignment.status === "pending" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onSkip(assignment.id)}>
                          Skip Assignment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function ReviewsTable({
  reviews,
  onFlag,
  onUnflag,
}: {
  reviews: PeerReview[];
  onFlag: (id: string, reason: string) => Promise<void>;
  onUnflag: (id: string) => Promise<void>;
}) {
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No reviews submitted yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reviewer</TableHead>
              <TableHead>Reviewed Team</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell className="font-medium">
                  {review.isAnonymous ? "Anonymous" : review.reviewerParticipantId.slice(0, 8)}
                </TableCell>
                <TableCell>
                  {review.assignment?.reviewedTeam?.name || "Unknown"}
                </TableCell>
                <TableCell>
                  <Badge variant="default">{Math.round(Number(review.overallScore))}%</Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(review.submittedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {review.isFlagged ? (
                    <Badge variant="destructive">
                      <Flag className="mr-1 h-3 w-3" />
                      Flagged
                    </Badge>
                  ) : (
                    <Badge variant="outline">OK</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {review.isFlagged ? (
                        <DropdownMenuItem onClick={() => onUnflag(review.id)}>
                          Remove Flag
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedReviewId(review.id);
                            setFlagDialogOpen(true);
                          }}
                        >
                          Flag Review
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Review</DialogTitle>
            <DialogDescription>
              Provide a reason for flagging this review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Reason for flagging..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (selectedReviewId && flagReason) {
                  await onFlag(selectedReviewId, flagReason);
                  setFlagDialogOpen(false);
                  setFlagReason("");
                }
              }}
            >
              Flag Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RubricsTable({
  rubrics,
  isLoading,
  onDelete,
}: {
  rubrics: any[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rubrics.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Settings className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No rubrics configured</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Criteria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rubrics.map((rubric) => (
              <TableRow key={rubric.id}>
                <TableCell className="font-medium">{rubric.name}</TableCell>
                <TableCell>{rubric.stageId ? "Stage-specific" : "Default"}</TableCell>
                <TableCell>{rubric.criteria?.length || 0} criteria</TableCell>
                <TableCell>
                  <Badge variant={rubric.isActive ? "default" : "secondary"}>
                    {rubric.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(rubric.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                if (deleteId) {
                  await onDelete(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AssignReviewsDialog({
  open,
  onOpenChange,
  cohortId,
  stages,
  onAssign,
  isAssigning,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string;
  stages?: Array<{ id: string; name: string; number: number }>;
  onAssign: (data: {
    cohortId: string;
    stageId: string;
    reviewsPerTeam: number;
    dueDate: string;
  }) => Promise<void>;
  isAssigning: boolean;
}) {
  const [stageId, setStageId] = useState("");
  const [reviewsPerTeam, setReviewsPerTeam] = useState(3);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stageId) {
      setError("Please select a stage");
      return;
    }
    if (!dueDate) {
      setError("Please set a due date");
      return;
    }
    setError(null);
    try {
      await onAssign({ cohortId, stageId, reviewsPerTeam, dueDate });
    } catch (err: any) {
      setError(err.message || "Failed to assign reviews");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Peer Reviews</DialogTitle>
          <DialogDescription>
            Automatically assign teams to review each other
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stages?.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    Stage {stage.number}: {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reviews Per Team</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={reviewsPerTeam}
              onChange={(e) => setReviewsPerTeam(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Each team will review this many other teams
            </p>
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isAssigning}>
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Reviews
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
