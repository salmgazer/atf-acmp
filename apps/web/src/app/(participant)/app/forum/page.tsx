"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CategoryList } from "@/components/forum";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import { Loader2, MessageSquare } from "lucide-react";

function ForumContent() {
  const { data: participant, isLoading } = useCurrentParticipant();

  if (isLoading || !participant) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Discussion Forum</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect with other participants, ask questions, and share ideas
        </p>
      </div>

      {/* Categories */}
      <CategoryList
        cohortId={participant.cohortId}
        basePath="/app/forum"
      />
    </div>
  );
}

export default function ParticipantForumPage() {
  return (
    <ProtectedRoute portal="participant">
      <ParticipantLayout>
        <ForumContent />
      </ParticipantLayout>
    </ProtectedRoute>
  );
}
