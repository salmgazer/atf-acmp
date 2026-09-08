"use client";

import { useParams } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ThreadDetail } from "@/components/forum";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import { Loader2 } from "lucide-react";

function ThreadContent() {
  const params = useParams();
  const threadId = params.id as string;
  const { data: participant, isLoading } = useCurrentParticipant();

  if (isLoading || !participant) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!threadId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Thread not found
      </div>
    );
  }

  return (
    <ThreadDetail
      threadId={threadId}
      basePath="/app/forum"
      currentUserId={participant.id}
      currentUserType="participant"
      isStaff={false}
    />
  );
}

export default function ParticipantForumThreadPage() {
  return (
    <ProtectedRoute portal="participant">
      <ParticipantLayout>
        <ThreadContent />
      </ParticipantLayout>
    </ProtectedRoute>
  );
}
