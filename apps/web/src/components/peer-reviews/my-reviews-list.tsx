"use client";

import { format, isPast } from "date-fns";
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  ClipboardList,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useMyAssignedReviews,
  PeerReviewAssignment,
  PeerReviewAssignmentStatus,
} from "@/lib/api/hooks/use-peer-reviews";

const statusConfig: Record<
  PeerReviewAssignmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  in_progress: { label: "In Progress", variant: "secondary", icon: ClipboardList },
  completed: { label: "Completed", variant: "default", icon: CheckCircle },
  skipped: { label: "Skipped", variant: "destructive", icon: AlertCircle },
};

export function MyReviewsList() {
  const { data: assignments, isLoading, error } = useMyAssignedReviews();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Failed to load assignments</p>
        </CardContent>
      </Card>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No Peer Reviews Assigned</h3>
          <p className="text-muted-foreground text-center max-w-md">
            You don't have any peer review assignments yet. Check back later when peer reviews are assigned for your cohort.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by status
  const pendingReviews = assignments.filter(
    (a) => a.status === "pending" || a.status === "in_progress"
  );
  const completedReviews = assignments.filter((a) => a.status === "completed");

  return (
    <div className="space-y-6">
      {/* Pending Reviews */}
      {pendingReviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Reviews ({pendingReviews.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pendingReviews.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Reviews */}
      {completedReviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Completed Reviews ({completedReviews.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {completedReviews.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: PeerReviewAssignment }) {
  const status = statusConfig[assignment.status];
  const StatusIcon = status.icon;
  const deadline = new Date(assignment.dueDate);
  const isOverdue = isPast(deadline) && assignment.status !== "completed";
  const canReview = assignment.status === "pending" || assignment.status === "in_progress";

  return (
    <Card className={isOverdue && canReview ? "border-destructive" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {assignment.reviewedTeam?.name || "Unknown Team"}
            </CardTitle>
            {assignment.reviewedTeam?.projectName && (
              <p className="text-sm text-muted-foreground mt-1">
                {assignment.reviewedTeam.projectName}
              </p>
            )}
          </div>
          <Badge variant={status.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage Info */}
        {assignment.stage && (
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-medium">
              {assignment.stage.number}
            </span>
            <span>{assignment.stage.name}</span>
          </div>
        )}

        {/* Due Date */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className={isOverdue && canReview ? "text-destructive font-medium" : "text-muted-foreground"}>
            {isOverdue && canReview ? "Overdue: " : "Due: "}
            {format(deadline, "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>

        {/* Action Button */}
        {canReview ? (
          <Button asChild className="w-full">
            <Link href={`/app/peer-reviews/${assignment.id}`}>
              {assignment.status === "in_progress" ? "Continue Review" : "Start Review"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          assignment.completedAt && (
            <p className="text-xs text-muted-foreground text-center">
              Completed on {format(new Date(assignment.completedAt), "MMM d, yyyy")}
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
