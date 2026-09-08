"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MoreHorizontal, Copy, Trash2, Eye, Pencil, AlertTriangle, Settings } from "lucide-react";
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

interface CohortsTableProps {
  cohorts: Cohort[];
  onDuplicate?: (cohort: Cohort) => void;
  onDelete?: (cohort: Cohort) => void;
}

export function CohortsTable({ cohorts, onDuplicate, onDelete }: CohortsTableProps) {
  if (cohorts.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No cohorts found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-80 max-w-80">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Stages
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
              Team Size
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">
              Created
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {cohorts.map((cohort) => {
            const hasNoStages = (cohort.stageCount ?? 0) === 0;
            
            return (
              <tr 
                key={cohort.id} 
                className={`hover:bg-muted/50 transition-colors ${hasNoStages ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
              >
                <td className="px-4 py-3 w-80 max-w-80">
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      {hasNoStages && (
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      )}
                      <Link
                        href={`/portal/cohorts/${cohort.id}`}
                        className="font-medium hover:underline"
                      >
                        {cohort.name}
                      </Link>
                    </div>
                    {cohort.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {cohort.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <CohortStatusBadge status={cohort.status} />
                </td>
                <td className="px-4 py-3 text-sm hidden md:table-cell">
                  {hasNoStages ? (
                    <span className="text-amber-600 font-medium">None</span>
                  ) : (
                    <span className="text-muted-foreground">{cohort.stageCount}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                  {cohort.teamSizeMin}-{cohort.teamSizeMax}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                  {format(new Date(cohort.createdAt), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/portal/cohorts/${cohort.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/portal/cohorts/${cohort.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      {hasNoStages && (
                        <DropdownMenuItem asChild>
                          <Link href={`/portal/cohorts/${cohort.id}/stages`}>
                            <Settings className="mr-2 h-4 w-4" />
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
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
