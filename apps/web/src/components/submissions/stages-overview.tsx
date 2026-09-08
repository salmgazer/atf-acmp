"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStages, Stage } from "@/lib/api/hooks/use-stages";
import { useMySubmissions, Submission } from "@/lib/api/hooks/use-submissions";

interface StageWithSubmission extends Stage {
  submission?: Submission;
}

export function StagesOverview({ cohortId }: { cohortId: string }) {
  const { data: stages, isLoading: stagesLoading } = useStages(cohortId, true);
  const { data: submissions, isLoading: submissionsLoading } = useMySubmissions();

  const stagesWithSubmissions = useMemo(() => {
    if (!stages) return [];
    
    return stages.map((stage): StageWithSubmission => ({
      ...stage,
      submission: submissions?.find((s) => s.stageId === stage.id),
    }));
  }, [stages, submissions]);

  const completedCount = stagesWithSubmissions.filter(
    (s) => s.submission?.status && ["submitted", "late", "evaluated"].includes(s.submission.status)
  ).length;

  const isLoading = stagesLoading || submissionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No stages available</h3>
          <p className="text-sm text-muted-foreground">
            Check back later for submission stages
          </p>
        </CardContent>
      </Card>
    );
  }

  // Find current stage (first non-submitted stage with open deadline)
  const currentStage = stagesWithSubmissions.find((s) => {
    const isSubmitted = s.submission?.status && ["submitted", "late", "evaluated"].includes(s.submission.status);
    return !isSubmitted && s.isOpen;
  });

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {completedCount} of {stages.length} stages completed
            </span>
            <span className="text-sm font-medium">
              {Math.round((completedCount / stages.length) * 100)}%
            </span>
          </div>
          <Progress value={(completedCount / stages.length) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Current Stage Highlight */}
      {currentStage && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="default">Current Stage</Badge>
              <DeadlineCountdown deadline={currentStage.deadline} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    {currentStage.number}
                  </span>
                  {currentStage.name}
                </h3>
                {currentStage.description && (
                  <p className="text-muted-foreground mt-2">
                    {currentStage.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(currentStage.deadline), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              </div>
              <Button asChild>
                <Link href={`/app/submissions/${currentStage.id}`}>
                  {currentStage.submission?.status === "draft" ? "Continue Draft" : "Start Submission"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Stages Timeline */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All Stages</h2>
        {stagesWithSubmissions.map((stage) => (
          <StageCard key={stage.id} stage={stage} isCurrent={stage.id === currentStage?.id} />
        ))}
      </div>
    </div>
  );
}

function StageCard({ stage, isCurrent }: { stage: StageWithSubmission; isCurrent: boolean }) {
  const submission = stage.submission;
  const deadline = new Date(stage.deadline);
  const isDeadlinePast = isPast(deadline);
  
  const getStatus = () => {
    if (submission?.status === "evaluated") return { label: "Evaluated", variant: "default" as const, icon: CheckCircle };
    if (submission?.status === "submitted") return { label: "Submitted", variant: "default" as const, icon: CheckCircle };
    if (submission?.status === "late") return { label: "Late Submission", variant: "secondary" as const, icon: AlertCircle };
    if (submission?.status === "draft") return { label: "Draft", variant: "outline" as const, icon: FileText };
    if (isDeadlinePast && !stage.allowLateSubmissions) return { label: "Closed", variant: "destructive" as const, icon: AlertCircle };
    if (isDeadlinePast) return { label: "Late", variant: "secondary" as const, icon: Clock };
    if (!stage.isOpen) return { label: "Not Open", variant: "secondary" as const, icon: Clock };
    return { label: "Pending", variant: "outline" as const, icon: Clock };
  };

  const status = getStatus();
  const StatusIcon = status.icon;
  const canSubmit = stage.isOpen || (isDeadlinePast && stage.allowLateSubmissions);
  const isSubmitted = submission?.status && ["submitted", "late", "evaluated"].includes(submission.status);

  return (
    <Card className={isCurrent ? "border-primary" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isSubmitted ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
            }`}>
              {isSubmitted ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <span className="font-bold">{stage.number}</span>
              )}
            </div>
            <div>
              <h3 className="font-medium flex items-center gap-2">
                {stage.name}
                <Badge variant={status.variant}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {status.label}
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                {isDeadlinePast
                  ? `Closed ${formatDistanceToNow(deadline, { addSuffix: true })}`
                  : `Due ${format(deadline, "MMM d, yyyy 'at' h:mm a")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {submission?.score !== undefined && submission.score !== null && (
              <Badge variant="outline" className="text-lg px-3 py-1">
                {submission.score}%
              </Badge>
            )}
            {canSubmit && !isSubmitted && (
              <Button asChild variant={isCurrent ? "default" : "outline"} size="sm">
                <Link href={`/app/submissions/${stage.id}`}>
                  {submission?.status === "draft" ? "Continue" : "Submit"}
                </Link>
              </Button>
            )}
            {isSubmitted && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/submissions/${stage.id}`}>View</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Feedback preview for evaluated submissions */}
        {submission?.feedback?.comments && (
          <div className="mt-3 p-3 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground line-clamp-2">
              <span className="font-medium">Feedback:</span> {submission.feedback.comments}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const date = new Date(deadline);
  const isOverdue = isPast(date);
  
  if (isOverdue) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" />
        Overdue
      </Badge>
    );
  }

  const distance = formatDistanceToNow(date, { addSuffix: false });
  
  return (
    <Badge variant="secondary">
      <Clock className="mr-1 h-3 w-3" />
      {distance} left
    </Badge>
  );
}
