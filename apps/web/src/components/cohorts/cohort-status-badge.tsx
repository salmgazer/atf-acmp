"use client";

import type { CohortStatus } from "@/lib/api/hooks/use-cohorts";

interface CohortStatusBadgeProps {
  status: CohortStatus;
}

const statusConfig: Record<CohortStatus, { label: string; bgClass: string; textClass: string }> = {
  draft: { label: "Draft", bgClass: "bg-muted", textClass: "text-muted-foreground" },
  active: { label: "Active", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600" },
  evaluation: { label: "Evaluation", bgClass: "bg-amber-500/15", textClass: "text-amber-600" },
  completed: { label: "Completed", bgClass: "bg-blue-500/15", textClass: "text-blue-600" },
  archived: { label: "Archived", bgClass: "bg-muted", textClass: "text-muted-foreground" },
};

export function CohortStatusBadge({ status }: CohortStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, bgClass: "bg-muted", textClass: "text-muted-foreground" };
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
      {config.label}
    </span>
  );
}
