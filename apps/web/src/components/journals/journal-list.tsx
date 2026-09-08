"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Edit,
  FileText,
  Loader2,
  Plus,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyJournals, JournalEntry } from "@/lib/api/hooks/use-journals";

export function JournalList() {
  const { data: journals, isLoading } = useMyJournals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determine current week number (approximate - could be enhanced with cohort start date)
  const currentWeek = journals && journals.length > 0
    ? Math.max(...journals.map((j) => j.weekNumber)) + 1
    : 1;

  const hasCurrentWeekEntry = journals?.some((j) => j.weekNumber === currentWeek - 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress Journal</h1>
          <p className="text-muted-foreground">
            Document your team's weekly progress and learnings
          </p>
        </div>
        <Button asChild>
          <Link href="/app/journals/new">
            <Plus className="mr-2 h-4 w-4" />
            New Entry
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{journals?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {journals?.reduce((sum, j) => sum + j.wordCount, 0) || 0}
                </p>
                <p className="text-sm text-muted-foreground">Total Words</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Week {currentWeek - 1}</p>
                <p className="text-sm text-muted-foreground">Latest Entry</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Journal Entries */}
      {!journals || journals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No journal entries yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Start documenting your team's progress by creating your first weekly entry
            </p>
            <Button asChild>
              <Link href="/app/journals/new">
                <Plus className="mr-2 h-4 w-4" />
                Create First Entry
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {journals.map((entry) => (
            <JournalCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <Link href={`/app/journals/${entry.id}`} className="block">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-lg font-bold text-primary">W{entry.weekNumber}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {entry.title || `Week ${entry.weekNumber} Update`}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {entry.content.slice(0, 200)}
                  {entry.content.length > 200 ? "..." : ""}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {entry.author
                      ? `${entry.author.firstName} ${entry.author.lastName}`
                      : "Team Member"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(entry.createdAt), "MMM d, yyyy")}
                  </span>
                  <span>{entry.wordCount} words</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {entry.canEdit && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="mr-1 h-3 w-3" />
                  {entry.hoursRemainingToEdit}h to edit
                </Badge>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {/* Quick tags */}
          <div className="flex flex-wrap gap-2 mt-3">
            {entry.highlights && entry.highlights.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {entry.highlights.length} highlights
              </Badge>
            )}
            {entry.challenges && entry.challenges.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {entry.challenges.length} challenges
              </Badge>
            )}
            {entry.nextWeekGoals && entry.nextWeekGoals.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {entry.nextWeekGoals.length} goals
              </Badge>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
