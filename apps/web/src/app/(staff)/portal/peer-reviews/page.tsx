"use client";

import { useState } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStages } from "@/lib/api/hooks/use-stages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPeerReviews } from "@/components/peer-reviews";

export default function PeerReviewsAdminPage() {
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const { data: cohorts, isLoading: cohortsLoading } = useCohorts();
  const { data: stages } = useStages(selectedCohortId || null);

  return (
    <ProtectedRoute requiredRole="admin">
      <StaffLayout>
        <div className="container py-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Peer Reviews Management</h1>
            <p className="text-muted-foreground">
              Configure rubrics and manage peer review assignments
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
                  <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Choose a cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts?.map((cohort) => (
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
            <AdminPeerReviews
              cohortId={selectedCohortId}
              stages={stages?.map((s) => ({
                id: s.id,
                name: s.name,
                number: s.number,
              }))}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">Select a Cohort</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Choose a cohort from the dropdown above to manage peer reviews
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </StaffLayout>
    </ProtectedRoute>
  );
}
