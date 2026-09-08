"use client";

import { use } from "react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { JournalForm } from "@/components/journals";
import { useJournal } from "@/lib/api/hooks/use-journals";
import { Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

function EditJournalContent({ id }: { id: string }) {
  const { data: entry, isLoading } = useJournal(id);

  if (isLoading) {
    return (
      <ParticipantLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      <JournalForm existingEntry={entry || undefined} />
    </ParticipantLayout>
  );
}

export default function EditJournalPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="participant">
      <EditJournalContent id={id} />
    </ProtectedRoute>
  );
}
