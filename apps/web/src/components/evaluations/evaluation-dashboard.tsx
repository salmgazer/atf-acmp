"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot,
  User,
  Play,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Edit,
  Send,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueueStatus } from "./queue-status";
import {
  useEvaluations,
  useEvaluationJobs,
  useEvaluationStats,
  useTriggerBatchEvaluation,
  useRetryJob,
  useCancelJob,
  usePublishEvaluations,
  Evaluation,
  EvaluationJob,
  EvaluationJobStatus,
} from "@/lib/api/hooks/use-evaluations";

interface EvaluationDashboardProps {
  cohortId: string;
  stages?: Array<{ id: string; name: string; number: number }>;
}

const jobStatusConfig: Record<
  EvaluationJobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  processing: { label: "Processing", variant: "secondary", icon: Loader2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

export function EvaluationDashboard({ cohortId, stages }: EvaluationDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [selectedEvaluations, setSelectedEvaluations] = useState<string[]>([]);

  const { data: evaluationsData, isLoading: evaluationsLoading } = useEvaluations({
    cohortId,
    stageId: selectedStageId || undefined,
  });
  const { data: jobsData, isLoading: jobsLoading } = useEvaluationJobs({
    cohortId,
    stageId: selectedStageId || undefined,
  });
  const { data: stats } = useEvaluationStats(cohortId, selectedStageId || null);

  const { trigger: triggerBatch, isMutating: isTriggering } = useTriggerBatchEvaluation();
  const { trigger: retryJob } = useRetryJob();
  const { trigger: cancelJob } = useCancelJob();
  const { trigger: publishEvaluations, isMutating: isPublishing } = usePublishEvaluations();

  const evaluations = evaluationsData?.data || [];
  const jobs = jobsData?.data || [];

  const handleTriggerEvaluation = async () => {
    if (!selectedStageId) {
      toast.error("Please select a stage");
      return;
    }

    try {
      const result = await triggerBatch({ cohortId, stageId: selectedStageId });
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      setShowTriggerDialog(false);
      toast.success(`Queued ${result.queued} evaluations, skipped ${result.skipped}`);
    } catch (error) {
      toast.error("Failed to trigger evaluations");
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob({ jobId });
      queryClient.invalidateQueries({ queryKey: ["evaluations", "jobs"] });
      toast.success("Job queued for retry");
    } catch (error) {
      toast.error("Failed to retry job");
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob({ jobId });
      queryClient.invalidateQueries({ queryKey: ["evaluations", "jobs"] });
      toast.success("Job cancelled");
    } catch (error) {
      toast.error("Failed to cancel job");
    }
  };

  const handlePublish = async () => {
    if (selectedEvaluations.length === 0) {
      toast.error("No evaluations selected");
      return;
    }

    try {
      await publishEvaluations({ evaluationIds: selectedEvaluations });
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      setSelectedEvaluations([]);
      toast.success(`Published ${selectedEvaluations.length} evaluations`);
    } catch (error) {
      toast.error("Failed to publish evaluations");
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Evaluations</h2>
          <p className="text-muted-foreground">
            Trigger AI evaluations and manage human scoring
          </p>
        </div>
        <Button onClick={() => setShowTriggerDialog(true)}>
          <Play className="mr-2 h-4 w-4" />
          Trigger Evaluation
        </Button>
      </div>

      {/* Queue Status */}
      <QueueStatus />

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
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold">{stats.totalTeams}</div>
              <div className="text-sm text-muted-foreground">Total Teams</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.evaluated}</div>
              <div className="text-sm text-muted-foreground">Evaluated</div>
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
              <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
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
      <Tabs defaultValue="evaluations">
        <TabsList>
          <TabsTrigger value="evaluations">
            Evaluations ({evaluations.length})
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Jobs ({jobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evaluations" className="mt-6">
          {/* Bulk Actions */}
          {selectedEvaluations.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedEvaluations.length} selected
              </span>
              <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Publish
              </Button>
            </div>
          )}

          <EvaluationsTable
            evaluations={evaluations}
            isLoading={evaluationsLoading}
            selectedIds={selectedEvaluations}
            onSelectionChange={setSelectedEvaluations}
          />
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          <JobsTable
            jobs={jobs}
            isLoading={jobsLoading}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        </TabsContent>
      </Tabs>

      {/* Trigger Dialog */}
      <Dialog open={showTriggerDialog} onOpenChange={setShowTriggerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger AI Evaluation</DialogTitle>
            <DialogDescription>
              Queue all submitted teams for AI evaluation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTriggerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleTriggerEvaluation} disabled={isTriggering || !selectedStageId}>
              {isTriggering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// Sub-components

function EvaluationsTable({
  evaluations,
  isLoading,
  selectedIds,
  onSelectionChange,
}: {
  evaluations: Evaluation[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No evaluations found</p>
        </CardContent>
      </Card>
    );
  }

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === evaluations.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(evaluations.map((e) => e.id));
    }
  };

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={selectedIds.length === evaluations.length}
                onChange={toggleAll}
                className="rounded"
              />
            </TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>AI Score</TableHead>
            <TableHead>Human Score</TableHead>
            <TableHead>Final</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evaluations.map((evaluation) => (
            <TableRow key={evaluation.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(evaluation.id)}
                  onChange={() => toggleSelection(evaluation.id)}
                  className="rounded"
                />
              </TableCell>
              <TableCell className="font-medium">
                {evaluation.team?.name || "Unknown"}
              </TableCell>
              <TableCell>
                {evaluation.stage ? `Stage ${evaluation.stage.number}` : "-"}
              </TableCell>
              <TableCell>
                {evaluation.aiOverallScore !== undefined ? (
                  <Badge variant="outline" className="text-purple-600">
                    <Bot className="mr-1 h-3 w-3" />
                    {Math.round(evaluation.aiOverallScore)}%
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </TableCell>
              <TableCell>
                {evaluation.humanOverallScore !== undefined ? (
                  <Badge variant="outline" className="text-blue-600">
                    <User className="mr-1 h-3 w-3" />
                    {Math.round(evaluation.humanOverallScore)}%
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </TableCell>
              <TableCell>
                {evaluation.finalScore !== undefined ? (
                  <span className="font-bold">{Math.round(evaluation.finalScore)}%</span>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {evaluation.isPublished ? (
                  <Badge variant="default">Published</Badge>
                ) : (
                  <Badge variant="outline">Draft</Badge>
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
                    <DropdownMenuItem asChild>
                      <Link href={`/portal/evaluations/${evaluation.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/portal/evaluations/${evaluation.id}/score`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Human Score
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function JobsTable({
  jobs,
  isLoading,
  onRetry,
  onCancel,
}: {
  jobs: EvaluationJob[];
  isLoading: boolean;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No jobs found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const status = jobStatusConfig[job.status];
            const StatusIcon = status.icon;

            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {job.team?.name || "Unknown"}
                </TableCell>
                <TableCell>
                  {job.stage ? `Stage ${job.stage.number}` : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>
                    <StatusIcon className={`mr-1 h-3 w-3 ${job.status === "processing" ? "animate-spin" : ""}`} />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{job.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {job.attempts}/{job.maxAttempts}
                </TableCell>
                <TableCell>
                  {format(new Date(job.createdAt), "MMM d, h:mm a")}
                </TableCell>
                <TableCell>
                  {(job.status === "failed" || job.status === "pending") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {job.status === "failed" && job.attempts < job.maxAttempts && (
                          <DropdownMenuItem onClick={() => onRetry(job.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                          </DropdownMenuItem>
                        )}
                        {job.status === "pending" && (
                          <DropdownMenuItem onClick={() => onCancel(job.id)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        )}
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
