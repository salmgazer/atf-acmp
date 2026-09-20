"use client";

import Link from "next/link";
import { format, formatDistanceToNow, isFuture } from "date-fns";
import {
  Users,
  FileText,
  Building2,
  ArrowRight,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Cohort, CohortStatistics } from "@/lib/api/hooks/use-cohorts";

interface ActiveCohortCardProps {
  cohort: Cohort;
  statistics?: CohortStatistics;
  isLoading?: boolean;
}

export function ActiveCohortCard({ cohort, statistics, isLoading }: ActiveCohortCardProps) {
  const getNextDeadline = () => {
    const deadlines = [
      { key: "briefSelectionEnd", label: "Brief Selection" },
      { key: "teamFormationEnd", label: "Team Formation" },
      { key: "stage1End", label: "Stage 1" },
      { key: "stage2End", label: "Stage 2" },
      { key: "stage3End", label: "Stage 3" },
      { key: "demoDay", label: "Demo Day" },
    ] as const;

    for (const { key, label } of deadlines) {
      const dateStr = cohort.deadlines[key];
      if (dateStr) {
        const date = new Date(dateStr);
        if (isFuture(date)) {
          return { label, date, dateStr };
        }
      }
    }
    return null;
  };

  const nextDeadline = getNextDeadline();

  return (
    <div className="rounded-xl bg-muted border border-border">
      {/* Main Section */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-600 px-3 py-1 text-xs font-medium">
              Active Cohort
            </span>
            <h2 className="mt-3 text-xl font-semibold text-foreground">{cohort.name}</h2>
            {cohort.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2 max-w-lg">
                {cohort.description}
              </p>
            )}
          </div>
          <Button
            asChild
            className="bg-zinc-900 text-white hover:bg-zinc-800 border-0 rounded-lg"
          >
            <Link href={`/portal/cohorts/${cohort.id}`}>
              View Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-5 flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{isLoading ? "—" : statistics?.participantCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">participants</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{isLoading ? "—" : statistics?.teamCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">teams</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{isLoading ? "—" : statistics?.briefCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">briefs</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{isLoading ? "—" : statistics?.organizationCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">orgs</span>
          </div>
        </div>
      </div>

      {/* Next Deadline */}
      {nextDeadline && (
        <div className="flex items-center gap-4 border-t border-border bg-card rounded-b-xl p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Next: {nextDeadline.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(nextDeadline.date, "EEEE, MMM d, yyyy")} • {formatDistanceToNow(nextDeadline.date, { addSuffix: true })}
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
            Upcoming
          </span>
        </div>
      )}
    </div>
  );
}

export function NoCohortCard() {
  return (
    <div className="rounded-xl bg-card p-8 border border-border">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">No Active Cohort</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          There is no active cohort at the moment. Create a new cohort or activate an existing one.
        </p>
        <Button asChild className="mt-6 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg">
          <Link href="/portal/cohorts">
            Manage Cohorts
          </Link>
        </Button>
      </div>
    </div>
  );
}
