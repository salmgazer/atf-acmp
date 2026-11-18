"use client";

import { use } from "react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { WorkflowSubmissionRouter } from "@/components/submissions/workflow-submission-router";

interface PageProps {
  params: Promise<{ stageId: string }>;
}

function SubmissionDetailContent({ stageId }: { stageId: string }) {
  return (
    <ParticipantLayout>
      <WorkflowSubmissionRouter stageId={stageId} />
    </ParticipantLayout>
  );
}

export default function SubmissionDetailPage({ params }: PageProps) {
  const { stageId } = use(params);

  return (
    <ProtectedRoute portal="participant">
      <SubmissionDetailContent stageId={stageId} />
    </ProtectedRoute>
  );
}
