"use client";

import { useState } from "react";
import Link from "next/link";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useMyMentorProfile,
  useMyMentorTeams,
  useMyMentorSessions,
} from "@/lib/api/hooks/use-mentors";
import {
  Users,
  MessageSquare,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  FileText,
  Building2,
  Trophy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

function DashboardContent() {
  const { data: profile, isLoading: profileLoading } = useMyMentorProfile();
  const { data: teams, isLoading: teamsLoading } = useMyMentorTeams();
  const { data: sessions } = useMyMentorSessions();

  const recentSessions = sessions?.slice(0, 3) || [];
  const totalSessionHours = sessions?.reduce((acc, s) => acc + s.durationMinutes, 0) || 0;

  if (profileLoading) {
    return (
      <MentorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MentorLayout>
    );
  }

  return (
    <MentorLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <div className="rounded-xl bg-gradient-to-r from-green-600 to-green-500 p-6 text-white">
          <h1 className="text-xl font-bold">
            Welcome back, {profile?.firstName || "Mentor"}!
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Help guide the next generation of African innovators.
          </p>
          {profile?.company && (
            <p className="mt-2 text-xs opacity-75">
              {profile.title} at {profile.company}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Teams</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">
              {teams?.length || 0}
              <span className="text-sm font-normal text-muted-foreground">
                /{profile?.maxTeams || 3}
              </span>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Hours</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">
              {Math.round(totalSessionHours / 60 * 10) / 10}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sessions</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">
              {sessions?.length || 0}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Messages</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">0</div>
          </div>
        </div>

        {/* Assigned Teams */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Your Teams</h2>
            <Link
              href="/mentor/teams"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {teamsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teams?.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No teams assigned yet
              </p>
              <p className="text-xs text-muted-foreground">
                Teams will appear here once assigned by staff
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {teams?.slice(0, 4).map((team: any) => (
                <Link
                  key={team.id}
                  href={`/mentor/teams/${team.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{team.name}</div>
                    {team.brief ? (
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{team.brief.title}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No brief assigned
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={team.status === "active" ? "default" : "secondary"}
                    >
                      {team.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Recent Sessions</h2>
            <Link
              href="/mentor/teams"
              className="text-sm text-primary hover:underline"
            >
              Log session
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No sessions logged yet
              </p>
              <p className="text-xs text-muted-foreground">
                Log your mentoring sessions to track progress
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentSessions.map((session) => (
                <div key={session.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{session.team?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.sessionDate), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{session.durationMinutes} min</span>
                    {session.topicsDiscussed.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{session.topicsDiscussed.length} topics</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MentorLayout>
  );
}

export default function MentorDashboardPage() {
  return (
    <ProtectedRoute portal="mentor">
      <DashboardContent />
    </ProtectedRoute>
  );
}
