"use client";

import Link from "next/link";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import {
  useMyMentorTeams,
  useMyScheduledSessions,
} from "@/lib/api/hooks/use-mentors";
import {
  Users,
  FileText,
  ChevronRight,
  Loader2,
  Clock,
  Calendar,
  Building2,
  CalendarDays,
  ExternalLink,
} from "lucide-react";

interface TeamTableRow {
  id: string;
  name: string;
  brief: { title: string; organization?: { name: string } } | null;
  members: any[];
  status: string;
  sessionCount: number;
  upcomingCount: number;
}

function TeamsContent() {
  const { data: teams, isLoading } = useMyMentorTeams();
  const { data: scheduledSessions } = useMyScheduledSessions();

  // Group scheduled sessions by team
  const sessionsByTeam = scheduledSessions?.reduce((acc, session) => {
    if (!acc[session.teamId]) acc[session.teamId] = [];
    acc[session.teamId].push(session);
    return acc;
  }, {} as Record<string, typeof scheduledSessions>);

  // Count upcoming sessions across all teams
  const upcomingCount = scheduledSessions?.filter(
    (s) => s.status === "scheduled" || s.status === "confirmed"
  ).length || 0;

  // Transform teams data for table
  const tableData: TeamTableRow[] = (teams || []).map((team: any) => {
    const teamSessions = sessionsByTeam?.[team.id] || [];
    const upcomingSessions = teamSessions.filter(
      (s) => s.status === "scheduled" || s.status === "confirmed"
    );

    return {
      id: team.id,
      name: team.name,
      brief: team.brief,
      members: team.members || [],
      status: team.status,
      sessionCount: teamSessions.length,
      upcomingCount: upcomingSessions.length,
    };
  });

  // Table columns definition
  const columns = [
    {
      key: "name",
      header: "Team",
      render: (_: unknown, row: TeamTableRow) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.members.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {row.members.slice(0, 3).map((member: any, idx: number) => (
                <div
                  key={member.id}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background"
                  style={{ marginLeft: idx > 0 ? -8 : 0 }}
                  title={`${member.participant.firstName} ${member.participant.lastName}`}
                >
                  {member.participant.firstName[0]}
                  {member.participant.lastName[0]}
                </div>
              ))}
              {row.members.length > 3 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{row.members.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "brief",
      header: "Brief",
      render: (_: unknown, row: TeamTableRow) =>
        row.brief ? (
          <div className="max-w-[200px]">
            <p className="font-medium truncate">{row.brief.title}</p>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "organization",
      header: "Organization",
      render: (_: unknown, row: TeamTableRow) =>
        row.brief?.organization ? (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{row.brief.organization.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "members",
      header: "Members",
      align: "center" as const,
      render: (_: unknown, row: TeamTableRow) => (
        <div className="flex items-center justify-center gap-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.members.length}</span>
        </div>
      ),
    },
    {
      key: "sessionCount",
      header: "Sessions",
      align: "center" as const,
      render: (_: unknown, row: TeamTableRow) => (
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-medium">{row.sessionCount}</span>
          {row.upcomingCount > 0 && (
            <span className="text-xs text-primary flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {row.upcomingCount} upcoming
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (_: unknown, row: TeamTableRow) => (
        <Badge
          variant={row.status === "active" ? "default" : "secondary"}
          className="text-xs"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (_: unknown, row: TeamTableRow) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/mentor/teams/${row.id}`}>
            View
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
    },
  ];

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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Your Teams</h1>
            <p className="text-sm text-muted-foreground">
              {teams?.length || 0} teams connected through sessions
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/mentor/calendar">
              <CalendarDays className="mr-2 h-4 w-4" />
              Calendar
              {upcomingCount > 0 && (
                <Badge variant="default" className="ml-2 h-5 px-1.5 text-xs">
                  {upcomingCount}
                </Badge>
              )}
            </Link>
          </Button>
        </div>

        {teams?.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No teams yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Teams will appear here once you have booked sessions with them.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden md:block">
              <DataTableCard<TeamTableRow>
                columns={columns}
                data={tableData}
                emptyMessage="No teams yet"
              />
            </div>

            {/* Mobile Card View - Hidden on desktop */}
            <div className="md:hidden space-y-4">
              {teams?.map((team: any) => {
                const teamSessions = sessionsByTeam?.[team.id] || [];
                const upcomingSessions = teamSessions.filter(
                  (s) => s.status === "scheduled" || s.status === "confirmed"
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
                            {upcomingSessions.length > 0 && (
                              <div className="flex items-center gap-1 text-primary">
                                <Clock className="h-3 w-3" />
                                <span>{upcomingSessions.length} upcoming</span>
                              </div>
                            )}
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
          </>
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
