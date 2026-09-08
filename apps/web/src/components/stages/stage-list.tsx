"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Edit,
  FileText,
  MoreVertical,
  Plus,
  Trash2,
  Video,
  Link as LinkIcon,
  Layers,
  CheckCircle,
  AlertCircle,
  FileCheck,
  Github,
  ExternalLink,
  Percent,
  AlignLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useStagesWithStats, useDeleteStage, Stage } from "@/lib/api/hooks/use-stages";
import { StageFormDialog } from "./stage-form-dialog";

interface StageListProps {
  cohortId: string;
}

const typeConfig = {
  document: { icon: FileText, label: "Document", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  video: { icon: Video, label: "Video", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  url: { icon: LinkIcon, label: "URL", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  text: { icon: AlignLeft, label: "Text", color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  mixed: { icon: Layers, label: "Mixed", color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
};

export function StageList({ cohortId }: StageListProps) {
  const queryClient = useQueryClient();
  const { data: stages, isLoading } = useStagesWithStats(cohortId);
  const deleteMutation = useDeleteStage();
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      setDeletingId(null);
    } catch (error) {
      console.error("Failed to delete stage:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border bg-card p-6">
            <div className="flex gap-4">
              <div className="h-14 w-14 rounded-xl bg-muted" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-48 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Stage
        </Button>
      </div>

      {stages && stages.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No stages configured</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Add stages to define the submission timeline for this cohort
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Stage
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {stages?.map((stage) => {
            const config = typeConfig[stage.type];
            const Icon = config.icon;
            const isPast = stage.isPastDeadline;
            const totalSubmissions = stage.stats
              ? stage.stats.submitted + stage.stats.late + stage.stats.evaluated
              : 0;

            const hasRequirements = stage.requirements && (
              stage.requirements.documentRequired ||
              stage.requirements.videoRequired ||
              stage.requirements.githubRequired ||
              stage.requirements.urlRequired ||
              stage.requirements.textRequired
            );

            return (
              <div
                key={stage.id}
                className={`group rounded-xl border bg-card transition-all hover:shadow-md ${
                  !stage.isActive ? "opacity-60" : ""
                }`}
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                        <span className="text-2xl font-bold text-primary">
                          {stage.number}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold">{stage.name}</h3>
                          {!stage.isActive && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                          {isPast && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Past Deadline
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                          {stage.weightPercentage > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Percent className="h-3 w-3" />
                              {stage.weightPercentage}% weight
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingStage(stage)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingId(stage.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Description */}
                  {stage.description && (
                    <p className="mt-3 text-sm text-muted-foreground pl-[4.5rem]">
                      {stage.description}
                    </p>
                  )}

                  {/* Stats Grid */}
                  <div className="mt-4 pl-[4.5rem] grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="text-xs text-muted-foreground">Deadline</p>
                        <p className={`font-medium ${isPast ? "text-amber-600" : ""}`}>
                          {format(new Date(stage.deadline), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="text-xs text-muted-foreground">Late Submissions</p>
                        <p className="font-medium">
                          {stage.allowLateSubmissions ? (
                            <span className="text-green-600">{stage.latePenaltyPercentage}% penalty</span>
                          ) : (
                            <span className="text-destructive">Not allowed</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {stage.stats && (
                      <>
                        <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <div className="text-sm">
                            <p className="text-xs text-muted-foreground">Submitted</p>
                            <p className="font-medium">{totalSubmissions}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <div className="text-sm">
                            <p className="text-xs text-muted-foreground">Drafts</p>
                            <p className="font-medium">{stage.stats.draft}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Requirements */}
                  {hasRequirements && (
                    <div className="mt-4 pl-[4.5rem] flex flex-wrap gap-2">
                      {stage.requirements?.documentRequired && (
                        <Badge variant="secondary" className="gap-1.5">
                          <FileCheck className="h-3 w-3" />
                          Document
                        </Badge>
                      )}
                      {stage.requirements?.videoRequired && (
                        <Badge variant="secondary" className="gap-1.5">
                          <Video className="h-3 w-3" />
                          Video
                        </Badge>
                      )}
                      {stage.requirements?.textRequired && (
                        <Badge variant="secondary" className="gap-1.5">
                          <AlignLeft className="h-3 w-3" />
                          {stage.requirements.textLabel || "Text"}
                        </Badge>
                      )}
                      {stage.requirements?.githubRequired && (
                        <Badge variant="secondary" className="gap-1.5">
                          <Github className="h-3 w-3" />
                          GitHub
                        </Badge>
                      )}
                      {stage.requirements?.urlRequired && (
                        <Badge variant="secondary" className="gap-1.5">
                          <ExternalLink className="h-3 w-3" />
                          {stage.requirements.urlLabel || "URL"}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <StageFormDialog
        cohortId={cohortId}
        stage={editingStage}
        open={isCreating || !!editingStage}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditingStage(null);
          }
        }}
        nextNumber={stages ? Math.max(...stages.map((s) => s.number), 0) + 1 : 1}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stage? This action cannot be undone.
              Stages with existing submissions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
