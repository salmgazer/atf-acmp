"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Loader2, AlertCircle } from "lucide-react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EvaluationDetail } from "@/components/evaluations";
import { useEvaluation } from "@/lib/api/hooks/use-evaluations";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EvaluationDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: evaluation, isLoading, error } = useEvaluation(id);

  return (
    <ProtectedRoute portal="staff">
      <StaffLayout>
        <div className="container py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/portal/evaluations")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {evaluation?.team?.name || "Evaluation"} Details
                </h1>
                {evaluation?.stage && (
                  <p className="text-muted-foreground">
                    Stage {evaluation.stage.number}: {evaluation.stage.name}
                  </p>
                )}
              </div>
            </div>
            {evaluation && (
              <Button onClick={() => router.push(`/portal/evaluations/${id}/score`)}>
                <Edit className="mr-2 h-4 w-4" />
                Human Score
              </Button>
            )}
          </div>

          {/* Content */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-muted-foreground">Failed to load evaluation</p>
              </CardContent>
            </Card>
          )}

          {evaluation && <EvaluationDetail evaluation={evaluation} />}
        </div>
      </StaffLayout>
    </ProtectedRoute>
  );
}
