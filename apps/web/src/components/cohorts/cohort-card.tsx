"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MoreHorizontal, Layers, Users, Calendar, ArrowRight, Copy, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CohortStatusBadge } from "./cohort-status-badge";
import type { Cohort } from "@/lib/api/hooks/use-cohorts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CohortCardProps {
  cohort: Cohort;
  onDuplicate?: (cohort: Cohort) => void;
  onDelete?: (cohort: Cohort) => void;
}

export function CohortCard({ cohort, onDuplicate, onDelete }: CohortCardProps) {
  const hasNoStages = (cohort.stageCount ?? 0) === 0;

  const getNextDeadline = () => {
    const deadlineKeys = [
      "briefSelectionEnd",
      "teamFormationEnd",
    ] as const;

    for (const key of deadlineKeys) {
      const dateStr = cohort.deadlines[key];
      if (dateStr) {
        const date = new Date(dateStr);
        if (date > new Date()) {
          return { key, date };
        }
      }
    }
    return null;
  };

  const nextDeadline = getNextDeadline();

  return (
    <div className={`rounded-xl border bg-card ${hasNoStages ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10" : "border-border"}`}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${hasNoStages ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
              {hasNoStages ? (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              ) : (
                <Layers className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <Link
                href={`/portal/cohorts/${cohort.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {cohort.name}
              </Link>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {cohort.description || "No description"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CohortStatusBadge status={cohort.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-lg">
                <DropdownMenuItem asChild>
                  <Link href={`/portal/cohorts/${cohort.id}`}>
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/portal/cohorts/${cohort.id}/edit`}>
                    Edit
                  </Link>
                </DropdownMenuItem>
                {hasNoStages && (
                  <DropdownMenuItem asChild>
                    <Link href={`/portal/cohorts/${cohort.id}/stages`}>
                      Configure Stages
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDuplicate?.(cohort)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                {cohort.status === "draft" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete?.(cohort)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {hasNoStages && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>No stages configured - <Link href={`/portal/cohorts/${cohort.id}/stages`} className="font-medium underline">add stages</Link></span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span>{cohort.stageCount ?? 0} stages</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{cohort.teamSizeMin}-{cohort.teamSizeMax} per team</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(cohort.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {nextDeadline && cohort.status === "active" && (
          <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Next: </span>
            <span className="font-medium text-foreground">
              {nextDeadline.key.replace(/End$/, "").replace(/([A-Z])/g, " $1").trim()} -{" "}
              {format(nextDeadline.date, "MMM d, yyyy")}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-border/50 px-5 py-3">
        <Link
          href={`/portal/cohorts/${cohort.id}`}
          className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View Cohort
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
