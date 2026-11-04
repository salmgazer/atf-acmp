"use client";

import { useState, useMemo } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LeaderboardTable, LeaderboardFilters } from "@/components/leaderboard";
import {
  useAdminLeaderboard,
  useLeaderboardConfig,
  useUpdateLeaderboardConfig,
  useExportLeaderboard,
  type LeaderboardQueryParams,
} from "@/lib/api/hooks/use-leaderboard";
import { useActiveCohort } from "@/lib/api/hooks/use-cohorts";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import {
  Trophy,
  Download,
  Settings,
  Loader2,
  Eye,
  EyeOff,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function LeaderboardContent() {
  const { data: activeCohort, isLoading: isLoadingCohort } = useActiveCohort();
  const { data: verticalsData } = useVerticals(activeCohort?.id || "");
  const { data: config, isLoading: isLoadingConfig } = useLeaderboardConfig(
    activeCohort?.id || ""
  );

  const [filters, setFilters] = useState<{
    verticalId?: string;
    country?: string;
  }>({});

  const [showStageScores, setShowStageScores] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateConfig = useUpdateLeaderboardConfig();
  const exportLeaderboard = useExportLeaderboard();

  const queryParams: LeaderboardQueryParams = useMemo(
    () => ({
      cohortId: activeCohort?.id || "",
      ...filters,
      limit: 100,
    }),
    [activeCohort?.id, filters]
  );

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useAdminLeaderboard(queryParams);

  // Extract unique countries from entries
  const countries = useMemo(() => {
    if (!leaderboard?.entries) return [];
    const uniqueCountries = new Set<string>();
    leaderboard.entries.forEach((e) => {
      if (e.country) uniqueCountries.add(e.country);
    });
    return Array.from(uniqueCountries).sort();
  }, [leaderboard?.entries]);

  const handleExport = () => {
    if (activeCohort?.id) {
      exportLeaderboard.mutate(queryParams);
    }
  };

  const handleConfigUpdate = (key: "isPublic" | "showScores", value: boolean) => {
    if (activeCohort?.id) {
      updateConfig.mutate({
        cohortId: activeCohort.id,
        config: { [key]: value },
      });
    }
  };

  if (!activeCohort && !isLoadingCohort) {
    return (
      <StaffLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Active Cohort</h2>
          <p className="mt-2 text-muted-foreground">
            Please activate a cohort to view the leaderboard.
          </p>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
            <p className="text-muted-foreground">
              {activeCohort?.name || "Loading..."} - Team rankings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportLeaderboard.isPending || !leaderboard?.entries?.length}
            >
              {exportLeaderboard.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export CSV
            </Button>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Leaderboard Settings</DialogTitle>
                  <DialogDescription>
                    Configure visibility and display options for the leaderboard.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {config?.isPublic ? (
                        <Globe className="h-5 w-5 text-green-500" />
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <Label htmlFor="public">Public Access</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow participants to view the leaderboard
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="public"
                      checked={config?.isPublic ?? false}
                      onCheckedChange={(checked: boolean) => handleConfigUpdate("isPublic", checked)}
                      disabled={updateConfig.isPending}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {config?.showScores ? (
                        <Eye className="h-5 w-5 text-blue-500" />
                      ) : (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <Label htmlFor="scores">Show Scores</Label>
                        <p className="text-sm text-muted-foreground">
                          Display actual scores (otherwise ranks only)
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="scores"
                      checked={config?.showScores ?? true}
                      onCheckedChange={(checked: boolean) => handleConfigUpdate("showScores", checked)}
                      disabled={updateConfig.isPending}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Status Badges */}
        {config && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
              {config.isPublic ? (
                <>
                  <Globe className="h-4 w-4 text-green-500" />
                  <span>Public</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>Internal Only</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
              {config.showScores ? (
                <>
                  <Eye className="h-4 w-4 text-blue-500" />
                  <span>Scores Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  <span>Ranks Only</span>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {leaderboard?.meta.total ?? 0} teams ranked
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between">
          <LeaderboardFilters
            verticals={verticalsData?.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })) ?? []}
            countries={countries}
            selectedVertical={filters.verticalId}
            selectedCountry={filters.country}
            onVerticalChange={(v) => setFilters((f) => ({ ...f, verticalId: v }))}
            onCountryChange={(c) => setFilters((f) => ({ ...f, country: c }))}
            onReset={() => setFilters({})}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="stage-scores" className="text-sm text-muted-foreground">
              Show stage scores
            </Label>
            <Switch
              id="stage-scores"
              checked={showStageScores}
              onCheckedChange={setShowStageScores}
            />
          </div>
        </div>

        {/* Leaderboard Table */}
        <LeaderboardTable
          entries={leaderboard?.entries ?? []}
          showScores={true}
          showStageScores={showStageScores}
          loading={isLoadingLeaderboard || isLoadingCohort}
        />
      </div>
    </StaffLayout>
  );
}

export default function AdminLeaderboardPage() {
  return (
    <ProtectedRoute portal="staff">
      <LeaderboardContent />
    </ProtectedRoute>
  );
}
