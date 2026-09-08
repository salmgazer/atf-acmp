"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ThreadList, NewThreadDialog } from "@/components/forum";
import { Loader2 } from "lucide-react";

function CategoryContent() {
  const params = useParams();
  const categoryId = params.id as string;
  const [showNewThread, setShowNewThread] = useState(false);

  if (!categoryId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <ThreadList
        categoryId={categoryId}
        basePath="/app/forum"
        onNewThread={() => setShowNewThread(true)}
      />

      <NewThreadDialog
        open={showNewThread}
        onOpenChange={setShowNewThread}
        categoryId={categoryId}
        basePath="/app/forum"
      />
    </div>
  );
}

export default function ParticipantForumCategoryPage() {
  return (
    <ProtectedRoute portal="participant">
      <ParticipantLayout>
        <CategoryContent />
      </ParticipantLayout>
    </ProtectedRoute>
  );
}
