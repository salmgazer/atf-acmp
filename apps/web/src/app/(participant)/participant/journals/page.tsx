"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { JournalList } from "@/components/journals";

function JournalsContent() {
  return (
    <ParticipantLayout>
      <JournalList />
    </ParticipantLayout>
  );
}

export default function JournalsPage() {
  return (
    <ProtectedRoute portal="participant">
      <JournalsContent />
    </ProtectedRoute>
  );
}
