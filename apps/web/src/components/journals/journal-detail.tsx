"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  Lightbulb,
  AlertTriangle,
  Target,
  User,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useJournal } from "@/lib/api/hooks/use-journals";

interface JournalDetailProps {
  id: string;
}

export function JournalDetail({ id }: JournalDetailProps) {
  const router = useRouter();
  const { data: entry, isLoading } = useJournal(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entry) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Journal entry not found</p>
          <Button className="mt-4" onClick={() => router.push("/app/journals")}>
            Back to Journals
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/app/journals")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                W{entry.weekNumber}
              </span>
              <div>
                <h1 className="text-2xl font-bold">
                  {entry.title || `Week ${entry.weekNumber} Update`}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {entry.author
                      ? `${entry.author.firstName} ${entry.author.lastName}`
                      : "Team Member"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(entry.createdAt), "MMMM d, yyyy")}
                  </span>
                  <span>{entry.wordCount} words</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {entry.canEdit && (
          <Button asChild variant="outline">
            <Link href={`/app/journals/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
              <Badge variant="secondary" className="ml-2">
                {entry.hoursRemainingToEdit}h left
              </Badge>
            </Link>
          </Button>
        )}
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{entry.content}</p>
          </div>
        </CardContent>
      </Card>

      {/* Highlights */}
      {entry.highlights && entry.highlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {entry.highlights.map((highlight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm">{highlight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Challenges */}
      {entry.challenges && entry.challenges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {entry.challenges.map((challenge, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm">{challenge}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next Week Goals */}
      {entry.nextWeekGoals && entry.nextWeekGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Next Week Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {entry.nextWeekGoals.map((goal, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm">{goal}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Created:</span>{" "}
              {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
            {entry.lastEditedAt && (
              <div>
                <span className="font-medium">Last edited:</span>{" "}
                {format(new Date(entry.lastEditedAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
            )}
            <div>
              <span className="font-medium">Edit window:</span>{" "}
              {entry.canEdit ? (
                <span className="text-green-600">
                  Open ({entry.hoursRemainingToEdit}h remaining)
                </span>
              ) : (
                <span className="text-muted-foreground">Closed</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
