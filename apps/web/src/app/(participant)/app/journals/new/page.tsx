"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { JournalForm } from "@/components/journals";

function NewJournalContent() {
  return (
    <ParticipantLayout>
      <JournalForm />
    </ParticipantLayout>
  );
}

export default function NewJournalPage() {
  return (
    <ProtectedRoute portal="participant">
      <NewJournalContent />
    </ProtectedRoute>
  );
}
