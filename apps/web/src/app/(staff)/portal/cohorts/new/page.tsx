"use client";

import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CohortForm } from "@/components/cohorts/cohort-form";
import { useCreateCohort } from "@/lib/api/hooks/use-cohorts";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function NewCohortContent() {
  const router = useRouter();
  const createMutation = useCreateCohort();

  const handleSubmit = async (data: any) => {
    const result = await createMutation.mutateAsync(data);
    router.push(`/portal/cohorts/${result.id}`);
  };

  const handleCancel = () => {
    router.push("/portal/cohorts");
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/portal/cohorts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Cohort</h1>
            <p className="text-muted-foreground">
              Set up a new AI Challenge cohort
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <CohortForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createMutation.isPending}
          />
        </div>
      </div>
    </StaffLayout>
  );
}

export default function NewCohortPage() {
  return (
    <ProtectedRoute portal="staff">
      <NewCohortContent />
    </ProtectedRoute>
  );
}
