"use client";

import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ChatView } from "@/components/chat";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCurrentMentor } from "@/lib/api/hooks/use-mentors";
import { Loader2 } from "lucide-react";

function ChatContent() {
  const { token } = useAuthStore();
  const { data: mentor, isLoading } = useCurrentMentor();

  if (isLoading || !mentor) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <p className="text-muted-foreground">Authentication required</p>
      </div>
    );
  }

  return (
    <ChatView
      token={token}
      currentUserId={mentor.id}
      currentUserType="mentor"
      className="h-[calc(100vh-120px)]"
    />
  );
}

export default function MentorChatPage() {
  return (
    <ProtectedRoute portal="mentor">
      <MentorLayout>
        <ChatContent />
      </MentorLayout>
    </ProtectedRoute>
  );
}
