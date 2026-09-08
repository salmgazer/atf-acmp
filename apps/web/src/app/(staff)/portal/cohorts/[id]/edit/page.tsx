"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CohortForm } from "@/components/cohorts/cohort-form";
import { useCohort, useUpdateCohort } from "@/lib/api/hooks/use-cohorts";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function EditCohortContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: cohort, isLoading, error } = useCohort(id);
  const updateMutation = useUpdateCohort();

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !cohort) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Failed to load cohort</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/cohorts">Back to Cohorts</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const handleSubmit = async (data: any) => {
    await updateMutation.mutateAsync({ id, data });
    router.push(`/portal/cohorts/${id}`);
  };

  const handleCancel = () => {
    router.push(`/portal/cohorts/${id}`);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/portal/cohorts/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Cohort</h1>
            <p className="text-muted-foreground">{cohort.name}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <CohortForm
            cohort={cohort}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={updateMutation.isPending}
          />
        </div>
      </div>
    </StaffLayout>
  );
}

export default function EditCohortPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="staff">
      <EditCohortContent id={id} />
    </ProtectedRoute>
  );
}
