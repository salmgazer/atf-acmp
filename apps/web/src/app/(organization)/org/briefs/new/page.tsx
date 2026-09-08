"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BriefForm } from "@/components/briefs/brief-form";
import { Button } from "@/components/ui/button";
import { useCreateBrief, type CreateBriefDto, type UpdateBriefDto } from "@/lib/api/hooks/use-briefs";
import { useCurrentOrganization } from "@/lib/api/hooks/use-organizations";
import { useMyOrganizationVerticals } from "@/lib/api/hooks/use-verticals";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

function NewBriefContent() {
  const router = useRouter();
  const { data: currentOrg, isLoading: isOrgLoading } = useCurrentOrganization();
  const { data: verticals, isLoading: isVerticalsLoading } = useMyOrganizationVerticals();
  const cohort = currentOrg?.cohort;
  const createMutation = useCreateBrief();

  const handleSubmit = (data: CreateBriefDto | UpdateBriefDto) => {
    createMutation.mutateAsync(data as CreateBriefDto).then((result) => {
      router.push(`/org/briefs/${result.id}`);
    });
  };

  const handleCancel = () => {
    router.push("/org/briefs");
  };

  if (isOrgLoading || isVerticalsLoading) {
    return (
      <OrganizationLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OrganizationLayout>
    );
  }

  if (!cohort) {
    return (
      <OrganizationLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/org/briefs">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Create Brief</h1>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-600" />
            <h2 className="mt-4 text-lg font-semibold">No Cohort Assigned</h2>
            <p className="mt-2 text-muted-foreground">
              Brief creation is only available when your organization is assigned to a cohort.
              Please contact the program administrators.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/org/briefs">Back to Briefs</Link>
            </Button>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  if (!currentOrg) {
    return (
      <OrganizationLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Organization not found</p>
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/org/briefs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Brief</h1>
            <p className="text-muted-foreground">
              Submit a challenge brief for {cohort.name}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <BriefForm
            cohortId={cohort.id}
            organizationId={currentOrg.id}
            verticals={verticals}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createMutation.isPending}
          />
        </div>
      </div>
    </OrganizationLayout>
  );
}

export default function NewBriefPage() {
  return (
    <ProtectedRoute portal="organization">
      <NewBriefContent />
    </ProtectedRoute>
  );
}
