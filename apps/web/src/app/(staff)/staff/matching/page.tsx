"use client";

import { useState } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  useMatchingPreview,
  useBriefCapacities,
  useTeamMatchStatus,
  useRunMatching,
  useFinalizeMatching,
  useClearMatchingPreview,
  type MatchingConfig,
  type MatchResult,
} from "@/lib/api/hooks/use-matching";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import {
  Shuffle,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Settings2,
  BarChart3,
  Users,
  FileText,
  Trophy,
  Target,
  Trash2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: typeof Users;
  variant?: "default" | "success" | "warning" | "info";
}) {
  const variantStyles = {
    default: "bg-card",
    success: "bg-green-50 dark:bg-green-900/20 border-green-200",
    warning: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200",
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200",
  };

  return (
    <div className={cn("rounded-lg border p-4", variantStyles[variant])}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {subtext && (
        <div className="mt-1 text-xs text-muted-foreground">{subtext}</div>
      )}
    </div>
  );
}

function MatchRow({ match, index }: { match: MatchResult; index: number }) {
  const getRankBadge = (rank: number | null) => {
    if (rank === null) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Unranked
        </Badge>
      );
    }
    const variants: Record<number, "default" | "secondary" | "outline"> = {
      1: "default",
      2: "secondary",
      3: "secondary",
    };
    return (
      <Badge variant={variants[rank] || "outline"}>
        #{rank} Choice
      </Badge>
    );
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3 text-sm text-muted-foreground">{index + 1}</td>
      <td className="p-3">
        <div className="font-medium">{match.teamName}</div>
      </td>
      <td className="p-3">
        <div>
          <div className="font-medium">{match.briefTitle}</div>
          <div className="text-xs text-muted-foreground">
            {match.organizationName}
          </div>
        </div>
      </td>
      <td className="p-3">{getRankBadge(match.rankPosition)}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-bold">{match.score}</span>
          <div className="text-xs text-muted-foreground">
            R:{match.scoreBreakdown.rankingScore} V:
            {match.scoreBreakdown.verticalScore} S:{match.scoreBreakdown.skillScore}
          </div>
        </div>
      </td>
      <td className="p-3">
        <div className="flex gap-1">
          {match.verticalMatch && (
            <Badge variant="outline" className="text-xs bg-purple-50">
              Vertical
            </Badge>
          )}
          {match.skillOverlap > 0 && (
            <Badge variant="outline" className="text-xs bg-blue-50">
              {match.skillOverlap} skills
            </Badge>
          )}
        </div>
      </td>
    </tr>
  );
}

function MatchingContent() {
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [config, setConfig] = useState<MatchingConfig>({
    firstChoiceWeight: 1.0,
    secondChoiceWeight: 0.8,
    thirdChoiceWeight: 0.6,
    fourthChoiceWeight: 0.4,
    fifthChoiceWeight: 0.2,
    verticalWeight: 0.5,
    skillOverlapWeight: 0.3,
    balanceDistribution: true,
  });

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  const { data: preview, isLoading: previewLoading } =
    useMatchingPreview(selectedCohortId);
  const { data: briefCapacities } = useBriefCapacities(selectedCohortId);
  const { data: teamStatus } = useTeamMatchStatus(selectedCohortId);

  const runMatchingMutation = useRunMatching();
  const finalizeMutation = useFinalizeMatching();
  const clearPreviewMutation = useClearMatchingPreview();

  const handleRunMatching = async () => {
    if (!selectedCohortId) return;

    try {
      await runMatchingMutation.mutateAsync({
        cohortId: selectedCohortId,
        dto: { config },
      });
      toast.success("Matching algorithm completed");
    } catch (error: any) {
      toast.error(error.message || "Failed to run matching");
    }
  };

  const handleFinalize = async () => {
    if (!selectedCohortId) return;

    try {
      const result = await finalizeMutation.mutateAsync({
        cohortId: selectedCohortId,
        dto: {},
      });

      if (result.errors.length > 0) {
        toast.warning(
          `Assigned ${result.assignedCount} teams with ${result.errors.length} errors`
        );
      } else {
        toast.success(`Successfully assigned ${result.assignedCount} teams`);
      }
      setShowFinalizeDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to finalize matching");
    }
  };

  const handleClearPreview = async () => {
    if (!selectedCohortId) return;
    await clearPreviewMutation.mutateAsync(selectedCohortId);
    toast.info("Preview cleared");
  };

  const eligibleTeams =
    teamStatus?.filter((t) => !t.currentBriefId).length || 0;
  const teamsWithPrefs =
    teamStatus?.filter((t) => t.hasPreferences && !t.currentBriefId).length || 0;
  const availableBriefs =
    briefCapacities?.filter((b) => b.availableSlots > 0).length || 0;

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shuffle className="h-6 w-6" />
              Team-Brief Matching
            </h1>
            <p className="text-muted-foreground">
              Automatically assign teams to briefs based on preferences
            </p>
          </div>
          <Select
            value={selectedCohortId || ""}
            onValueChange={setSelectedCohortId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedCohortId ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <Shuffle className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Select a Cohort</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a cohort to run the matching algorithm
            </p>
          </div>
        ) : (
          <>
            {/* Pre-run Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Eligible Teams"
                value={eligibleTeams}
                subtext={`${teamsWithPrefs} with preferences`}
                icon={Users}
              />
              <StatCard
                label="Available Briefs"
                value={availableBriefs}
                subtext={`of ${briefCapacities?.length || 0} total`}
                icon={FileText}
              />
              <StatCard
                label="Teams with Preferences"
                value={
                  eligibleTeams > 0
                    ? `${Math.round((teamsWithPrefs / eligibleTeams) * 100)}%`
                    : "0%"
                }
                icon={Target}
                variant={teamsWithPrefs === eligibleTeams ? "success" : "warning"}
              />
              <StatCard
                label="Total Slots"
                value={
                  briefCapacities?.reduce((sum, b) => sum + b.availableSlots, 0) ||
                  0
                }
                icon={BarChart3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setShowConfigDialog(true)}
                variant="outline"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Configure
              </Button>
              <Button
                onClick={handleRunMatching}
                disabled={
                  runMatchingMutation.isPending ||
                  eligibleTeams === 0 ||
                  availableBriefs === 0
                }
              >
                {runMatchingMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Run Matching
              </Button>
              {preview && (
                <>
                  <Button
                    onClick={() => setShowFinalizeDialog(true)}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={finalizeMutation.isPending}
                  >
                    {finalizeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Finalize Assignments
                  </Button>
                  <Button
                    onClick={handleClearPreview}
                    variant="outline"
                    className="text-destructive"
                    disabled={clearPreviewMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Preview
                  </Button>
                </>
              )}
            </div>

            {/* Preview Results */}
            {preview && (
              <div className="space-y-6">
                {/* Warnings */}
                {preview.warnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="h-5 w-5" />
                      <h3 className="font-semibold">Warnings</h3>
                    </div>
                    <ul className="mt-2 list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                      {preview.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Results Stats */}
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Matching Results</h2>
                    <span className="text-sm text-muted-foreground">
                      Generated{" "}
                      {format(
                        new Date(preview.generatedAt),
                        "MMM d, yyyy 'at' h:mm a"
                      )}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="Teams Matched"
                      value={`${preview.statistics.matchedTeams}/${preview.statistics.totalTeams}`}
                      icon={CheckCircle2}
                      variant="success"
                    />
                    <StatCard
                      label="Average Score"
                      value={preview.statistics.averageScore}
                      subtext="out of 100"
                      icon={Trophy}
                    />
                    <StatCard
                      label="First Choice"
                      value={`${preview.statistics.firstChoicePercentage}%`}
                      subtext={`${preview.statistics.matchedToRankedBrief} to ranked brief`}
                      icon={Target}
                      variant="info"
                    />
                    <StatCard
                      label="Top 3 Choices"
                      value={`${preview.statistics.topThreePercentage}%`}
                      icon={BarChart3}
                      variant="info"
                    />
                  </div>

                  {preview.unmatchedTeamIds.length > 0 && (
                    <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {preview.unmatchedTeamIds.length} teams could not be
                          matched
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Matches Table */}
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold">
                      Match Preview ({preview.matches.length} assignments)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium w-12">
                            #
                          </th>
                          <th className="text-left p-3 text-sm font-medium">
                            Team
                          </th>
                          <th className="text-left p-3 text-sm font-medium">
                            Brief
                          </th>
                          <th className="text-left p-3 text-sm font-medium">
                            Rank
                          </th>
                          <th className="text-left p-3 text-sm font-medium">
                            Score
                          </th>
                          <th className="text-left p-3 text-sm font-medium">
                            Match Factors
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.matches.map((match, index) => (
                          <MatchRow
                            key={match.teamId}
                            match={match}
                            index={index}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Matching Configuration</DialogTitle>
            <DialogDescription>
              Adjust weights for the matching algorithm
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Ranking Weights</h4>
              {[
                { key: "firstChoiceWeight", label: "1st Choice" },
                { key: "secondChoiceWeight", label: "2nd Choice" },
                { key: "thirdChoiceWeight", label: "3rd Choice" },
                { key: "fourthChoiceWeight", label: "4th Choice" },
                { key: "fifthChoiceWeight", label: "5th Choice" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <div className="flex items-center gap-2 w-48">
                    <Slider
                      value={[config[key as keyof MatchingConfig] as number]}
                      onValueChange={([value]) =>
                        setConfig((c) => ({ ...c, [key]: value }))
                      }
                      max={1}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-sm w-8 text-right">
                      {config[key as keyof MatchingConfig]}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm">Other Factors</h4>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Vertical Match</Label>
                <div className="flex items-center gap-2 w-48">
                  <Slider
                    value={[config.verticalWeight || 0.5]}
                    onValueChange={([value]) =>
                      setConfig((c) => ({ ...c, verticalWeight: value }))
                    }
                    max={1}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">
                    {config.verticalWeight}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Skill Overlap</Label>
                <div className="flex items-center gap-2 w-48">
                  <Slider
                    value={[config.skillOverlapWeight || 0.3]}
                    onValueChange={([value]) =>
                      setConfig((c) => ({ ...c, skillOverlapWeight: value }))
                    }
                    max={1}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">
                    {config.skillOverlapWeight}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Balance Distribution</Label>
                <p className="text-xs text-muted-foreground">
                  Spread teams across briefs evenly
                </p>
              </div>
              <Switch
                checked={config.balanceDistribution}
                onCheckedChange={(checked) =>
                  setConfig((c) => ({ ...c, balanceDistribution: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowConfigDialog(false)}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Matching</DialogTitle>
            <DialogDescription>
              This will assign briefs to {preview?.statistics.matchedTeams || 0}{" "}
              teams. This action can be reversed by staff manually.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Teams to assign:</span>
                <span className="font-medium">
                  {preview?.statistics.matchedTeams}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>First choice matches:</span>
                <span className="font-medium">
                  {preview?.statistics.firstChoicePercentage}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unmatched teams:</span>
                <span className="font-medium">
                  {preview?.statistics.unmatchedTeams}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFinalizeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={finalizeMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {finalizeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirm & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function MatchingPage() {
  return (
    <ProtectedRoute portal="staff">
      <MatchingContent />
    </ProtectedRoute>
  );
}
