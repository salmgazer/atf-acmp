"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StagesOverview } from "@/components/submissions";
import { useAuth } from "@/lib/auth/use-auth";

function SubmissionsContent() {
  const { user } = useAuth();
  
  // Get cohortId from user's participant profile
  const cohortId = user?.participant?.cohortId;

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>
          <p className="text-muted-foreground">
            View and manage your team's stage submissions
          </p>
        </div>

        {cohortId ? (
          <StagesOverview cohortId={cohortId} />
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
