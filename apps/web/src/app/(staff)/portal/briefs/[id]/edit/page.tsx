"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BriefForm } from "@/components/briefs/brief-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBrief, useStaffUpdateBrief, type StaffUpdateBriefDto } from "@/lib/api/hooks/use-briefs";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ArrowLeft, Loader2, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  in_review: { label: "In Review", variant: "default" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  revision_requested: { label: "Revision Requested", variant: "outline" },
};

function StaffEditBriefContent({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: brief, isLoading, error } = useBrief(id);
  const { data: verticals } = useVerticals(brief?.cohortId);
  const updateMutation = useStaffUpdateBrief();
  const [editComment, setEditComment] = useState("");

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !brief) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Brief not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/briefs">Back to Briefs</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const config = statusConfig[brief.status] || { label: brief.status, variant: "secondary" as const };
  const isApprovedOrRejected = ["approved", "rejected"].includes(brief.status);

  const handleSubmit = async (data: StaffUpdateBriefDto) => {
    if (!user) return;

    await updateMutation.mutateAsync({
      id,
      data: {
        ...data,
        editComment: editComment || undefined,
      },
      actorId: user.id,
      actorName: `${user.firstName} ${user.lastName}`,
    });
    router.push(`/portal/briefs/${id}`);
  };

  const handleCancel = () => {
    router.push(`/portal/briefs/${id}`);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/portal/briefs/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Edit Brief</h1>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            <p className="text-muted-foreground">{brief.title}</p>
            <p className="text-sm text-muted-foreground">
              Organization: {brief.organization?.name || "Unknown"}
            </p>
          </div>
        </div>

        {/* Warning for non-draft/revision statuses */}
        {!["draft", "revision_requested"].includes(brief.status) && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Staff Edit Mode
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  You are editing a brief with status "{config.label}". This change will be recorded 
                  in the revision history with your name. {isApprovedOrRejected && 
                  "Since this brief has already been reviewed, consider whether this edit is necessary."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Comment Section */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="editComment" className="font-medium">Edit Comment (Optional)</Label>
          </div>
          <Textarea
            id="editComment"
            placeholder="Describe the reason for this edit (e.g., 'Fixed typo in problem statement', 'Updated outcomes per organization request')..."
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            rows={2}
            className="mb-2"
          />
          <p className="text-xs text-muted-foreground">
            This comment will be recorded in the revision history and visible to other staff members.
          </p>
        </div>

        {/* Brief Form */}
        <div className="rounded-lg border bg-card p-6">
          <BriefForm
            brief={brief}
            cohortId={brief.cohortId}
            organizationId={brief.organizationId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={updateMutation.isPending}
            verticals={verticals}
            showVerticalStats={true}
          />
        </div>
      </div>
    </StaffLayout>
  );
}

export default function StaffEditBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="staff">
      <StaffEditBriefContent id={id} />
    </ProtectedRoute>
  );
}
