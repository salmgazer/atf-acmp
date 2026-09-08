"use client";

import { useState } from "react";
import Link from "next/link";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useMyMentorTeams,
  useMyMentorSessions,
} from "@/lib/api/hooks/use-mentors";
import {
  Users,
  FileText,
  ChevronRight,
  Loader2,
  Clock,
  Calendar,
  Building2,
  User,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

function TeamsContent() {
  const { data: teams, isLoading } = useMyMentorTeams();
  const { data: sessions } = useMyMentorSessions();

  // Group sessions by team
  const sessionsByTeam = sessions?.reduce((acc, session) => {
    if (!acc[session.teamId]) acc[session.teamId] = [];
    acc[session.teamId].push(session);
    return acc;
  }, {} as Record<string, typeof sessions>);

  if (isLoading) {
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
        <div>
          <h1 className="text-xl font-bold">Your Teams</h1>
          <p className="text-sm text-muted-foreground">
            {teams?.length || 0} teams assigned to you
          </p>
        </div>

        {teams?.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No teams assigned</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Teams will appear here once staff assigns them to you.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {teams?.map((team: any) => {
              const teamSessions = sessionsByTeam?.[team.id] || [];
              const totalMinutes = teamSessions.reduce(
                (acc, s) => acc + s.durationMinutes,
                0
              );

              return (
                <div key={team.id} className="rounded-lg border bg-card overflow-hidden">
                  <Link
                    href={`/mentor/teams/${team.id}`}
                    className="block p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{team.name}</h3>
                          <Badge
                            variant={team.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {team.status}
                          </Badge>
                        </div>

                        {team.brief ? (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 text-sm">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{team.brief.title}</span>
                            </div>
                            {team.brief.organization && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                                <Building2 className="h-3 w-3" />
                                <span>{team.brief.organization.name}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            No brief assigned
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{team.members?.length || 0} members</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{teamSessions.length} sessions</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{Math.round(totalMinutes / 60 * 10) / 10}h logged</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>

                  {/* Team Members Preview */}
                  {team.members && team.members.length > 0 && (
                    <div className="border-t px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-2 overflow-x-auto">
                        {team.members.slice(0, 4).map((member: any) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 flex-shrink-0 text-xs"
                          >
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-[10px] font-medium">
                                {member.participant.firstName[0]}
                                {member.participant.lastName[0]}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {member.participant.firstName}
                            </span>
                          </div>
                        ))}
                        {team.members.length > 4 && (
                          <span className="text-xs text-muted-foreground">
                            +{team.members.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MentorLayout>
  );
}

export default function MentorTeamsPage() {
  return (
    <ProtectedRoute portal="mentor">
      <TeamsContent />
    </ProtectedRoute>
  );
}
