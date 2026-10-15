"use client";

import { use } from "react";
import { PeerReviewForm } from "@/components/peer-reviews";

interface PageProps {
  params: Promise<{ assignmentId: string }>;
}

export default function PeerReviewPage({ params }: PageProps) {
  const { assignmentId } = use(params);

  return (
    <div className="container py-6">
      <PeerReviewForm assignmentId={assignmentId} />
    </div>
  );
}
