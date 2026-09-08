"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import { useMyTeam } from "@/lib/api/hooks/use-teams";
import { useCohort } from "@/lib/api/hooks/use-cohorts";
import { useStages, Stage } from "@/lib/api/hooks/use-stages";
import { 
  Loader2, 
  Users, 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Lock
} from "lucide-react";
import { format, isPast, isFuture, differenceInDays } from "date-fns";

type TeamRole = "lead" | "co_lead" | "member";

interface StageWithStatus extends Stage {
  status: "upcoming" | "open" | "closed";
  daysRemaining: number | null;
  canSubmit: boolean;
}

/**
 * Determines the participant's current phase based on team status and brief selection
 */
function getCurrentPhase(hasTeam: boolean, hasBrief: boolean): {
  phase: "team_formation" | "brief_selection" | "challenge";
  label: string;
  number: number;
} {
  if (!hasTeam) {
    return { phase: "team_formation", label: "Team Formation", number: 1 };
  }
  if (!hasBrief) {
    return { phase: "brief_selection", label: "Brief Selection", number: 2 };
  }
  return { phase: "challenge", label: "Challenge Phase", number: 3 };
}

/**
 * Calculates days remaining from a deadline
 */
function getDaysRemaining(deadline: string | Date | undefined): number | null {
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  if (isPast(deadlineDate)) return 0;
  return differenceInDays(deadlineDate, new Date());
}

/**
 * Formats a deadline for display
 */
function formatDeadline(deadline: string | Date | undefined): string {
  if (!deadline) return "Not set";
  const date = new Date(deadline);
  if (isPast(date)) return "Passed";
  const days = differenceInDays(date, new Date());
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days} days left`;
  return format(date, "MMM d, yyyy");
}

/**
 * Gets the user's role in the team
 */
function getMemberRole(team: any, participantId: string): TeamRole | null {
  if (!team?.members) return null;
  const member = team.members.find((m: any) => m.participantId === participantId);
  return member?.role || null;
}

/**
 * Checks if user can submit (lead or co_lead only)
 */
function canUserSubmit(role: TeamRole | null): boolean {
  return role === "lead" || role === "co_lead";
}

function DashboardContent() {
  const router = useRouter();
  const { data: participant, isLoading } = useCurrentParticipant();
  const { data: team, isLoading: teamLoading } = useMyTeam(participant?.id || "");
  const { data: cohort, isLoading: cohortLoading } = useCohort(participant?.cohortId || "");
  const { data: stages, isLoading: stagesLoading } = useStages(participant?.cohortId, true);

  useEffect(() => {
    // Redirect to onboarding if not complete
    if (participant && !participant.onboardingComplete) {
      router.push("/app/onboarding");
    }
  }, [participant, router]);

  // Calculate user's role in team
  const userRole = useMemo(() => {
    if (!team || !participant) return null;
    return getMemberRole(team, participant.id);
  }, [team, participant]);

  // Process stages with status and permissions
  const stagesWithStatus: StageWithStatus[] = useMemo(() => {
    if (!stages) return [];
    
    const userCanSubmit = canUserSubmit(userRole);

    return stages.map((stage) => {
      const startDate = stage.startDate ? new Date(stage.startDate) : null;
      const deadline = new Date(stage.deadline);
      
      let status: "upcoming" | "open" | "closed";
      if (startDate && isFuture(startDate)) {
        status = "upcoming";
      } else if (isPast(deadline) && !stage.allowLateSubmissions) {
        status = "closed";
      } else if (isPast(deadline) && stage.allowLateSubmissions) {
        status = "open"; // Late submissions allowed
      } else {
        status = "open";
      }

      return {
        ...stage,
        status,
        daysRemaining: getDaysRemaining(stage.deadline),
        canSubmit: userCanSubmit && status === "open",
      };
    }).sort((a, b) => a.number - b.number);
  }, [stages, userRole]);

  // Get active (open) stages
  const activeStages = useMemo(() => {
    return stagesWithStatus.filter((s) => s.status === "open");
  }, [stagesWithStatus]);

  // Calculate overall progress
  const { currentPhase, progressPercent, totalStages } = useMemo(() => {
    const hasTeam = !!team;
    const hasBrief = !!team?.briefId;
    const phase = getCurrentPhase(hasTeam, hasBrief);
    
    // Progress calculation:
    // Phase 1 (Team Formation): 0-25%
    // Phase 2 (Brief Selection): 25-50%
    // Phase 3 (Challenge): 50-100% (based on stage completion)
    let percent = 0;
    if (hasTeam) percent = 25;
    if (hasBrief) percent = 50;
    
    // In challenge phase, add progress based on stages
    if (hasBrief && stagesWithStatus.length > 0) {
      const closedStages = stagesWithStatus.filter((s) => s.status === "closed").length;
      const stageProgress = (closedStages / stagesWithStatus.length) * 50;
      percent = 50 + stageProgress;
    }

    return {
      currentPhase: phase,
      progressPercent: Math.round(percent),
      totalStages: stagesWithStatus.length,
    };
  }, [team, stagesWithStatus]);

  if (isLoading || teamLoading || cohortLoading || stagesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render until we know onboarding is complete
  if (!participant?.onboardingComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasTeam = !!team;
  const hasBrief = !!team?.briefId;

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
          <h1 className="text-xl font-bold">
            Welcome, {participant.firstName}!
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Your AI Challenge journey starts here.
          </p>
        </div>

        {/* Current Stage */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Current Phase</div>
              <div className="font-semibold">{currentPhase.label}</div>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${
              hasTeam && hasBrief
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : hasTeam
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}>
              {hasTeam && hasBrief ? "In Challenge" : hasTeam ? "Team Formed" : "In Progress"}
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-muted">
              <div 
                className="h-2 rounded-full bg-primary transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Phase {currentPhase.number} of 3
              {totalStages > 0 && hasBrief && ` • ${totalStages} challenge stage${totalStages !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        {/* Role Badge (if in team) */}
        {hasTeam && userRole && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Your role:</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              userRole === "lead" 
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                : userRole === "co_lead"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
            }`}>
              {userRole === "lead" ? "Team Lead" : userRole === "co_lead" ? "Co-Lead" : "Member"}
            </span>
            {userRole === "member" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                View only for submissions
              </span>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {hasTeam ? (
            <Link
              href="/app/team"
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="mt-3 font-medium">My Team</div>
              <div className="text-xs text-muted-foreground">{team.name}</div>
            </Link>
          ) : (
            <Link
              href="/app/team"
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-3 font-medium">Find Team</div>
              <div className="text-xs text-muted-foreground">Join or create a team</div>
            </Link>
          )}
          <Link
            href="/app/briefs"
            className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-3 font-medium">View Briefs</div>
            <div className="text-xs text-muted-foreground">Browse challenges</div>
          </Link>
        </div>

        {/* Active Stages (only show when in challenge phase) */}
        {hasBrief && activeStages.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Active Stages</h2>
              <span className="text-xs text-muted-foreground">
                ({activeStages.length} open)
              </span>
            </div>
            <div className="space-y-3">
              {activeStages.map((stage) => (
                <Link
                  key={stage.id}
                  href={`/app/submissions/${stage.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                      {stage.number}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{stage.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Due: {format(new Date(stage.deadline), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stage.daysRemaining !== null && stage.daysRemaining <= 3 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        {stage.daysRemaining === 0 ? "Due today" : `${stage.daysRemaining}d left`}
                      </span>
                    )}
                    {!stage.canSubmit && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Stages Overview (when in challenge phase) */}
        {hasBrief && stagesWithStatus.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Challenge Stages</h2>
            </div>
            <div className="space-y-2">
              {stagesWithStatus.map((stage) => (
                <div 
                  key={stage.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    stage.status === "open" 
                      ? "bg-primary/5" 
                      : stage.status === "closed"
                      ? "bg-muted/50"
                      : "bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium ${
                      stage.status === "open"
                        ? "bg-primary text-primary-foreground"
                        : stage.status === "closed"
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {stage.status === "closed" ? "✓" : stage.number}
                    </div>
                    <span className={`text-sm ${stage.status === "closed" ? "text-muted-foreground" : ""}`}>
                      {stage.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${
                      stage.status === "open" && stage.daysRemaining !== null && stage.daysRemaining <= 3
                        ? "text-red-600 dark:text-red-400 font-medium"
                        : "text-muted-foreground"
                    }`}>
                      {stage.status === "upcoming" 
                        ? `Opens ${format(new Date(stage.startDate!), "MMM d")}`
                        : stage.status === "closed"
                        ? "Closed"
                        : formatDeadline(stage.deadline)
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Deadlines */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Upcoming Deadlines</h2>
          </div>
          <div className="mt-3 space-y-3">
            {/* Team Formation Deadline */}
            {!hasTeam && cohort?.deadlines?.teamFormationEnd && (
              <DeadlineItem
                title="Team Formation"
                subtitle="Form your team"
                deadline={cohort.deadlines.teamFormationEnd}
              />
            )}
            
            {/* Brief Selection Deadline */}
            {hasTeam && !hasBrief && cohort?.deadlines?.briefSelectionEnd && (
              <DeadlineItem
                title="Brief Selection"
                subtitle="Choose your challenge"
                deadline={cohort.deadlines.briefSelectionEnd}
              />
            )}

            {/* Stage Deadlines (show next 2 open stages) */}
            {hasBrief && activeStages.slice(0, 2).map((stage) => (
              <DeadlineItem
                key={stage.id}
                title={`Stage ${stage.number}: ${stage.name}`}
                subtitle="Submit your work"
                deadline={stage.deadline}
              />
            ))}

            {/* Demo Day */}
            {cohort?.deadlines?.demoDay && hasBrief && (
              <DeadlineItem
                title="Demo Day"
                subtitle="Final presentations"
                deadline={cohort.deadlines.demoDay}
                variant="highlight"
              />
            )}

            {/* No deadlines message */}
            {!cohort?.deadlines?.teamFormationEnd && 
             !cohort?.deadlines?.briefSelectionEnd && 
             activeStages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No upcoming deadlines
              </p>
            )}
          </div>
        </div>
      </div>
    </ParticipantLayout>
  );
}

/**
 * Deadline item component with countdown
 */
function DeadlineItem({ 
  title, 
  subtitle, 
  deadline,
  variant = "default" 
}: { 
  title: string; 
  subtitle: string; 
  deadline: string;
  variant?: "default" | "highlight";
}) {
  const deadlineDate = new Date(deadline);
  const isPastDeadline = isPast(deadlineDate);
  const daysLeft = getDaysRemaining(deadline);
  const isUrgent = daysLeft !== null && daysLeft <= 3 && !isPastDeadline;

  if (isPastDeadline) return null; // Don't show past deadlines

  return (
    <div className={`flex items-center justify-between ${
      variant === "highlight" ? "p-2 rounded-lg bg-primary/5" : ""
    }`}>
      <div>
        <div className={`text-sm font-medium ${variant === "highlight" ? "text-primary" : ""}`}>
          {title}
        </div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className={`flex items-center gap-1 text-sm ${
        isUrgent 
          ? "text-red-600 dark:text-red-400 font-medium" 
          : "text-muted-foreground"
      }`}>
        <Clock className="h-3.5 w-3.5" />
        {formatDeadline(deadline)}
      </div>
    </div>
  );
}

export default function ParticipantDashboardPage() {
  return (
    <ProtectedRoute portal="participant">
      <DashboardContent />
    </ProtectedRoute>
  );
}
