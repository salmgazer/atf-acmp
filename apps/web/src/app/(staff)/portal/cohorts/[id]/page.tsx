"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CohortStatusBadge } from "@/components/cohorts/cohort-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useCohort,
  useCohortStatistics,
  useUpdateCohortStatus,
  useDeleteCohort,
  type CohortStatus,
} from "@/lib/api/hooks/use-cohorts";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import {
  useTeamFormationPreview,
  useRunTeamFormation,
  useFinalizeTeamFormation,
  useClearTeamFormationPreview,
} from "@/lib/api/hooks/use-matching";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  Archive,
  Loader2,
  Users,
  FileText,
  Building2,
  Calendar,
  Layers,
  Globe,
  Settings,
  ClipboardList,
  AlertTriangle,
  Wand2,
  UserPlus,
} from "lucide-react";
import { useStagesWithStats } from "@/lib/api/hooks/use-stages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

const statusTransitions: Record<CohortStatus, { next: CohortStatus | null; label: string; icon: typeof Play }> = {
  draft: { next: "active", label: "Activate", icon: Play },
  active: { next: "evaluation", label: "Start Evaluation", icon: Pause },
  evaluation: { next: "completed", label: "Mark Complete", icon: CheckCircle },
  completed: { next: "archived", label: "Archive", icon: Archive },
  archived: { next: null, label: "", icon: Archive },
};

function CohortDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: cohort, isLoading, error } = useCohort(id);
  const { data: statistics } = useCohortStatistics(id);
  const { data: verticals } = useVerticals(id);
  const { data: stages } = useStagesWithStats(id);
  const updateStatusMutation = useUpdateCohortStatus();
  const deleteMutation = useDeleteCohort();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showFormationDialog, setShowFormationDialog] = useState(false);
  
  // Team Formation
  const { data: formationPreview, isLoading: formationLoading } = useTeamFormationPreview(id);
  const runFormationMutation = useRunTeamFormation();
  const finalizeFormationMutation = useFinalizeTeamFormation();
  const clearFormationMutation = useClearTeamFormationPreview();

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !cohort) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Failed to load cohort</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/cohorts">Back to Cohorts</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const transition = statusTransitions[cohort.status];
  const hasNoStages = !stages?.length && (cohort.stageCount ?? 0) === 0;

  const handleStatusChange = async () => {
    if (!transition.next) return;
    await updateStatusMutation.mutateAsync({ id, status: transition.next });
    setShowStatusDialog(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    router.push("/portal/cohorts");
  };

  const handleRunFormation = async () => {
    await runFormationMutation.mutateAsync({ cohortId: id });
  };

  const handleFinalizeFormation = async () => {
    await finalizeFormationMutation.mutateAsync({ cohortId: id });
    setShowFormationDialog(false);
  };

  const handleClearFormation = async () => {
    await clearFormationMutation.mutateAsync(id);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/portal/cohorts">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{cohort.name}</h1>
                <CohortStatusBadge status={cohort.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {transition.next && (
              <Button
                variant="default"
                onClick={() => setShowStatusDialog(true)}
              >
                <transition.icon className="mr-2 h-4 w-4" />
                {transition.label}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/portal/cohorts/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            {cohort.status === "draft" && (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Missing Stages Warning */}
        {hasNoStages && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Stages Not Configured
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This cohort doesn't have any stages set up yet. Stages are required to manage submissions and evaluations.
                </p>
                <Button asChild className="mt-3" size="sm">
                  <Link href={`/portal/cohorts/${id}/stages`}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Configure Stages
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-100 p-2">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participants</p>
                <p className="text-2xl font-bold">{statistics?.participantCount ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-purple-100 p-2">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teams</p>
                <p className="text-2xl font-bold">{statistics?.teamCount ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-orange-100 p-2">
                <FileText className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Briefs</p>
                <p className="text-2xl font-bold">{statistics?.briefCount ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-green-100 p-2">
                <Building2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Organizations</p>
                <p className="text-2xl font-bold">{statistics?.organizationCount ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Formation Section */}
        {cohort.status === "active" && (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <UserPlus className="h-5 w-5" />
                  Team Formation
                  {(statistics?.participantsWithoutTeam ?? 0) > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {statistics?.participantsWithoutTeam} without team
                    </Badge>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically form teams from participants who haven't joined a team yet
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formationPreview && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearFormation}
                      disabled={clearFormationMutation.isPending}
                    >
                      Clear Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowFormationDialog(true)}
                      disabled={finalizeFormationMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finalize ({formationPreview.proposedTeams.length} teams)
                    </Button>
                  </>
                )}
                {!formationPreview && (
                  <Button
                    onClick={handleRunFormation}
                    disabled={runFormationMutation.isPending}
                  >
                    {runFormationMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Run Team Formation
                  </Button>
                )}
              </div>
            </div>

            {/* Formation Preview */}
            {formationPreview && (
              <div className="mt-4 space-y-4">
                <Separator />
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formationPreview.statistics?.totalEligibleParticipants ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Participants Available</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formationPreview.statistics?.proposedTeamCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Teams to Create</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formationPreview.statistics?.averageTeamSize?.toFixed(1) ?? '0.0'}</p>
                    <p className="text-xs text-muted-foreground">Avg Team Size</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formationPreview.statistics?.averageCompatibilityScore?.toFixed(0) ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Avg Compatibility</p>
                  </div>
                </div>

                {formationPreview.statistics?.backfillStats?.teamsToBackfillCount > 0 && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>Backfill:</strong> {formationPreview.statistics.backfillStats.participantsToBackfillCount} participants 
                      will be added to {formationPreview.statistics.backfillStats.teamsToBackfillCount} existing teams to reach optimal size.
                    </p>
                  </div>
                )}

                {formationPreview.warnings.length > 0 && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Warnings:</p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                      {formationPreview.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Preview generated {new Date(formationPreview.generatedAt).toLocaleString()}
                </p>
              </div>
            )}

            {!formationPreview && !formationLoading && (
              <p className="text-sm text-muted-foreground mt-3">
                Click "Run Team Formation" to generate a preview of proposed teams based on participant preferences, 
                skills, and interests. You can review before finalizing.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Settings className="h-5 w-5" />
              Configuration
            </h2>
            <Separator className="my-4" />
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Team Size</dt>
                <dd className="font-medium">{cohort.teamSizeMin} - {cohort.teamSizeMax} members</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Brief Cap</dt>
                <dd className="font-medium">{cohort.briefCap}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Teams per Brief</dt>
                <dd className="font-medium">{cohort.maxTeamsPerBrief}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{format(new Date(cohort.createdAt), "MMM d, yyyy")}</dd>
              </div>
            </dl>
          </div>

          {/* Deadlines */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5" />
              Deadlines
            </h2>
            <Separator className="my-4" />
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Registration</dt>
                <dd className="font-medium">
                  {cohort.deadlines.registrationEnd
                    ? format(new Date(cohort.deadlines.registrationEnd), "MMM d, yyyy")
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Team Formation</dt>
                <dd className="font-medium">
                  {cohort.deadlines.teamFormationEnd
                    ? format(new Date(cohort.deadlines.teamFormationEnd), "MMM d, yyyy")
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground mt-4">
              Stage deadlines are managed separately in the{" "}
              <Link href={`/portal/cohorts/${id}/stages`} className="underline hover:text-foreground">
                Stages
              </Link>{" "}
              section.
            </p>
          </div>

          {/* Countries */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Globe className="h-5 w-5" />
              Countries ({cohort.countries?.length || 0})
            </h2>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-2">
              {cohort.countries?.length ? (
                cohort.countries.map((country) => (
                  <Badge key={country} variant="secondary">
                    {country}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No countries configured</p>
              )}
            </div>
          </div>

          {/* Verticals */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Layers className="h-5 w-5" />
                Verticals ({verticals?.length || 0})
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link href={`/portal/cohorts/${id}/verticals`}>Manage</Link>
              </Button>
            </div>
            <Separator className="my-4" />
            {verticals?.length ? (
              <div className="space-y-2">
                {verticals.map((vertical) => (
                  <div
                    key={vertical.id}
                    className="flex items-center justify-between rounded-md bg-muted/50 p-2"
                  >
                    <span className="font-medium">{vertical.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {vertical.briefCount}/{vertical.briefCap} briefs
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No verticals configured</p>
            )}
          </div>

          {/* Stages */}
          <div className={`rounded-lg border bg-card p-6 lg:col-span-2 ${hasNoStages ? "border-amber-500/50" : ""}`}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ClipboardList className="h-5 w-5" />
                Stages ({stages?.length || 0})
              </h2>
              <Button asChild variant={hasNoStages ? "default" : "outline"} size="sm">
                <Link href={`/portal/cohorts/${id}/stages`}>
                  {hasNoStages ? "Add Stages" : "Manage"}
                </Link>
              </Button>
            </div>
            <Separator className="my-4" />
            {stages?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-sm font-bold text-primary">
                        {stage.number}
                      </span>
                      <span className="font-medium truncate">{stage.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Deadline: {format(new Date(stage.deadline), "MMM d, yyyy")}</p>
                      {stage.stats && (
                        <p>
                          {stage.stats.submitted + stage.stats.late + stage.stats.evaluated} submitted
                          {stage.stats.draft > 0 && `, ${stage.stats.draft} drafts`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  No stages configured. Add stages to enable submissions and evaluations.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{transition.label} Cohort</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the status of "{cohort.name}" from{" "}
              <strong>{cohort.status}</strong> to <strong>{transition.next}</strong>?
              {transition.next === "active" && (
                <span className="block mt-2 text-warning">
                  Note: Only one cohort can be active at a time.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cohort</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{cohort.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Formation Finalize Dialog */}
      <Dialog open={showFormationDialog} onOpenChange={setShowFormationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Team Formation</DialogTitle>
            <DialogDescription>
              This will create {formationPreview?.statistics?.proposedTeamCount ?? 0} new teams 
              with {formationPreview?.statistics?.totalEligibleParticipants ?? 0} participants.
              {formationPreview?.statistics?.backfillStats?.teamsToBackfillCount && formationPreview.statistics.backfillStats.teamsToBackfillCount > 0 && (
                <span className="block mt-2">
                  Additionally, {formationPreview.statistics.backfillStats.participantsToBackfillCount} participants 
                  will be added to existing teams.
                </span>
              )}
              <span className="block mt-2 font-medium">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormationDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalizeFormation}
              disabled={finalizeFormationMutation.isPending}
            >
              {finalizeFormationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Create Teams
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function CohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  
  return (
    <ProtectedRoute portal="staff">
      <CohortDetailContent id={id} />
    </ProtectedRoute>
  );
}
