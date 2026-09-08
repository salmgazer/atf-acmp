"use client";

import { use } from "react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SubmissionForm } from "@/components/submissions";

interface PageProps {
  params: Promise<{ stageId: string }>;
}

function SubmissionDetailContent({ stageId }: { stageId: string }) {
  return (
    <ParticipantLayout>
      <SubmissionForm stageId={stageId} />
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
