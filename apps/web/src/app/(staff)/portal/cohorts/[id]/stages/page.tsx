"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageList } from "@/components/stages";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";

interface PageProps {
  params: Promise<{ id: string }>;
}

function StagesContent({ cohortId }: { cohortId: string }) {
  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/portal/cohorts/${cohortId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stages</h1>
            <p className="text-muted-foreground">
              Configure submission stages and deadlines for this cohort
            </p>
          </div>
        </div>

        <StageList cohortId={cohortId} />
      </div>
    </StaffLayout>
  );
}

export default function CohortStagesPage({ params }: PageProps) {
  const { id: cohortId } = use(params);

  return (
    <ProtectedRoute portal="staff">
      <StagesContent cohortId={cohortId} />
    </ProtectedRoute>
  );
}
