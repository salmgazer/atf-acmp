"use client";

import { useState, useEffect } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStages } from "@/lib/api/hooks/use-stages";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvaluationDashboard } from "@/components/evaluations";

export default function EvaluationsPage() {
  // Get global cohort from store (set by sidebar)
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);
  
  // Local cohort filter - initialized from global but can be overridden
  const [localCohortId, setLocalCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Initialize local cohort from global when component mounts or global changes (if not yet set locally)
  useEffect(() => {
    if (globalCohortId && !hasInitialized) {
      setLocalCohortId(globalCohortId);
      setHasInitialized(true);
    }
  }, [globalCohortId, hasInitialized]);
  
  // Use local cohort if set, otherwise fall back to global
  const selectedCohortId = localCohortId || globalCohortId || "";
  
  // Handle local cohort change (doesn't affect global sidebar)
  const handleCohortChange = (cohortId: string) => {
    setLocalCohortId(cohortId);
    setHasInitialized(true);
  };
  
  const { data: cohorts, isLoading: cohortsLoading } = useCohorts();
  const { data: stages } = useStages(selectedCohortId || undefined);

  return (
    <ProtectedRoute portal="staff">
      <StaffLayout>
        <div className="container py-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">AI Evaluations</h1>
            <p className="text-muted-foreground">
              Trigger AI evaluations and manage human scoring
            </p>
          </div>

          {/* Cohort Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label>Select Cohort:</Label>
                {cohortsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Select value={selectedCohortId} onValueChange={handleCohortChange}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Choose a cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts?.data?.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          {selectedCohortId ? (
            stages?.filter((s) => s.requiresAiEvaluation).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-1">No AI Evaluation Stages</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-4">
                    This cohort doesn&apos;t have any stages configured for AI evaluation yet.
                    Enable AI evaluation on stages to use this feature.
                  </p>
                  <Button variant="outline" asChild>
                    <a href={`/portal/cohorts/${selectedCohortId}/stages`}>
                      Configure Stages
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <EvaluationDashboard
                cohortId={selectedCohortId}
                stages={stages
                  ?.filter((s) => s.requiresAiEvaluation)
                  .map((s) => ({
                    id: s.id,
                    name: s.name,
                    number: s.number,
                  }))}
              />
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">Select a Cohort</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Choose a cohort from the dropdown above to manage AI evaluations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </StaffLayout>
    </ProtectedRoute>
  );
}
