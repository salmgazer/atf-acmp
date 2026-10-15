"use client";

import { use } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { HumanScoringForm } from "@/components/evaluations";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function HumanScoringPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="staff">
      <StaffLayout>
        <div className="container py-6">
          <HumanScoringForm evaluationId={id} />
        </div>
      </StaffLayout>
    </ProtectedRoute>
  );
}
