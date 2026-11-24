"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { TeamWorkflowOverview } from "@/components/submissions/team-workflow-overview";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";

function SubmissionsContent() {
  const { data: participant, isLoading, isError } = useCurrentParticipant();
  
  // Get cohortId from user's participant profile
  const cohortId = participant?.cohortId;

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your team’s six steps</h1>
          <p className="text-muted-foreground">
            Follow your team’s progress from formation to the final MVP
          </p>
        </div>

        {isLoading ? <p>Loading participant profile…</p> : isError ? <p role="alert">Could not load your profile. Please reload to retry.</p> : cohortId ? (
          <TeamWorkflowOverview />
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              You need to be enrolled in a cohort to view submissions.
            </p>
          </div>
        )}
      </div>
    </ParticipantLayout>
  );
}

export default function SubmissionsPage() {
  return (
    <ProtectedRoute portal="participant">
      <SubmissionsContent />
    </ProtectedRoute>
  );
}
