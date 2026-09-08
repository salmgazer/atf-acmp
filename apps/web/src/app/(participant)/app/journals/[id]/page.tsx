"use client";

import { use } from "react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { JournalDetail } from "@/components/journals";

interface PageProps {
  params: Promise<{ id: string }>;
}

function JournalDetailContent({ id }: { id: string }) {
  return (
    <ParticipantLayout>
      <JournalDetail id={id} />
    </ParticipantLayout>
  );
}

export default function JournalDetailPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="participant">
      <JournalDetailContent id={id} />
    </ProtectedRoute>
  );
}
