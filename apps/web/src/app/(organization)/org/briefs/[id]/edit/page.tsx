"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BriefForm } from "@/components/briefs/brief-form";
import { Button } from "@/components/ui/button";
import { useBrief, useUpdateBrief, type UpdateBriefDto } from "@/lib/api/hooks/use-briefs";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

function EditBriefContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: brief, isLoading, error } = useBrief(id);
  const updateMutation = useUpdateBrief();

  if (isLoading) {
    return (
      <OrganizationLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OrganizationLayout>
    );
  }

  if (error || !brief) {
    return (
      <OrganizationLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Brief not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/org/briefs">Back to Briefs</Link>
          </Button>
        </div>
      </OrganizationLayout>
    );
  }

  const canEdit = ["draft", "revision_requested"].includes(brief.status);

  if (!canEdit) {
    return (
      <OrganizationLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/org/briefs/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Edit Brief</h1>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-600" />
            <h2 className="mt-4 text-lg font-semibold">Cannot Edit</h2>
            <p className="mt-2 text-muted-foreground">
              This brief cannot be edited because it has status "{brief.status}".
              Only drafts and briefs with revision requests can be edited.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href={`/org/briefs/${id}`}>Back to Brief</Link>
            </Button>
          </div>
        </div>
      </OrganizationLayout>
    );
  }

  const handleSubmit = async (data: UpdateBriefDto) => {
    await updateMutation.mutateAsync({ id, data });
    router.push(`/org/briefs/${id}`);
  };

  const handleCancel = () => {
    router.push(`/org/briefs/${id}`);
  };

  return (
    <OrganizationLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/org/briefs/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Brief</h1>
            <p className="text-muted-foreground">{brief.title}</p>
          </div>
        </div>

        {brief.status === "revision_requested" && brief.reviewFeedback && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Revision Feedback</span>
            </div>
            <p className="mt-2 text-yellow-700 dark:text-yellow-300">
              {brief.reviewFeedback}
            </p>
          </div>
        )}

        <div className="rounded-lg border bg-card p-6">
          <BriefForm
            brief={brief}
            cohortId={brief.cohortId}
            organizationId={brief.organizationId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={updateMutation.isPending}
          />
        </div>
      </div>
    </OrganizationLayout>
  );
}

export default function EditBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="organization">
      <EditBriefContent id={id} />
    </ProtectedRoute>
  );
}
