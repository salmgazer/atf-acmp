"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ResourceList } from "@/components/resources";

function ResourcesContent() {
  return (
    <ParticipantLayout>
      <ResourceList />
    </ParticipantLayout>
  );
}

export default function ResourcesPage() {
  return (
    <ProtectedRoute portal="participant">
      <ResourcesContent />
    </ProtectedRoute>
  );
}
