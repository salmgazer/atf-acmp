"use client";

import { useState } from "react";
import Link from "next/link";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useMyScheduledSessions,
  useConfirmSession,
  useDeclineSession,
  type ScheduledSession,
} from "@/lib/api/hooks/use-mentors";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  Video,
  ExternalLink,
  Users,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Check,
  X,
  XCircle,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, isFuture } from "date-fns";
import { cn } from "@/lib/utils";

function CalendarContent() {
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  
  const { data: sessions, isLoading } = useMyScheduledSessions();
  const confirmSession = useConfirmSession();
  const declineSession = useDeclineSession();

  // Separate sessions by status
  const now = new Date();
  
  // Pending sessions that need action (scheduled status)
  const pendingSessions = sessions
    ?.filter((s) => s.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()) || [];

  // Upcoming confirmed sessions
  const upcomingSessions = sessions
    ?.filter((s) => s.status === "confirmed" && new Date(s.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()) || [];
  
  const pastSessions = sessions
    ?.filter((s) => s.status === "completed" || (s.status !== "cancelled" && s.status !== "declined" && new Date(s.scheduledAt) < now))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()) || [];

  // Group upcoming sessions by date
  const groupedUpcoming = upcomingSessions.reduce((acc, session) => {
    const dateKey = format(new Date(session.scheduledAt), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, ScheduledSession[]>);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEEE, MMMM d");
  };

  const getStatusBadge = (session: ScheduledSession) => {
    switch (session.status) {
      case "confirmed":
        return <Badge variant="default" className="bg-green-600">Confirmed</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Awaiting Your Response</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return null;
    }
  };

  const handleConfirm = async (sessionId: string) => {
    try {
      await confirmSession.mutateAsync(sessionId);
      toast.success("Session confirmed", {
        description: "The team will be notified that you've accepted.",
      });
      setSelectedSession(null);
    } catch (error) {
      toast.error("Failed to confirm session. Please try again.");
    }
  };

  const handleDecline = async () => {
    if (!selectedSession) return;
    try {
      await declineSession.mutateAsync({
        sessionId: selectedSession.id,
        reason: declineReason || undefined,
      });
      toast.success("Session declined", {
        description: "The team will be notified to book a different time.",
      });
      setDeclineDialogOpen(false);
      setDeclineReason("");
      setSelectedSession(null);
    } catch (error) {
      toast.error("Failed to decline session. Please try again.");
    }
  };

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
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/mentor/teams">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Session Calendar</h1>
            <p className="text-sm text-muted-foreground">
              {pendingSessions.length > 0 && (
                <span className="text-amber-600 font-medium">{pendingSessions.length} pending request{pendingSessions.length !== 1 ? 's' : ''} • </span>
              )}
              {upcomingSessions.length} confirmed session{upcomingSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Pending Session Requests */}
        {pendingSessions.length > 0 && (
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <div className="p-4 border-b border-amber-200 dark:border-amber-800">
              <h2 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending Session Requests ({pendingSessions.length})
              </h2>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Review and respond to these session requests from teams
              </p>
            </div>
            <div className="divide-y divide-amber-200 dark:divide-amber-800">
              {pendingSessions.map((session) => (
                <div key={session.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {format(new Date(session.scheduledAt), "EEE, MMM d")} at {format(new Date(session.scheduledAt), "h:mm a")}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {session.durationMinutes} min
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{session.team?.name}</span>
                        <Badge variant="outline" className="text-xs">
                          Session {session.sessionNumber}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        <span className="font-medium">Question:</span> {session.question}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(session.id)}
                      disabled={confirmSession.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {confirmSession.isPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-3 w-3" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSession(session);
                        setDeclineDialogOpen(true);
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                    >
                      <X className="mr-2 h-3 w-3" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSession(session)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Confirmed Sessions */}
        {upcomingSessions.length === 0 && pendingSessions.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No upcoming sessions</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Sessions will appear here when teams book time with you
            </p>
          </div>
        ) : upcomingSessions.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Confirmed Sessions
            </h2>
            {Object.entries(groupedUpcoming).map(([dateKey, daySessions]) => (
              <div key={dateKey}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {getDateLabel(dateKey)}
                </h3>
                <div className="space-y-3">
                  {daySessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="w-full text-left rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">
                              {format(new Date(session.scheduledAt), "h:mm a")}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">
                              {session.durationMinutes} min
                            </span>
                            {getStatusBadge(session)}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{session.team?.name}</span>
                            <Badge variant="outline" className="text-xs">
                              Session {session.sessionNumber}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {session.question}
                          </p>
                        </div>
                        {session.googleMeetLink && (
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <div className="pt-6 border-t">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4">
              Past Sessions ({pastSessions.length})
            </h2>
            <div className="space-y-2">
              {pastSessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="w-full text-left rounded-lg border bg-card/50 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-medium">{session.team?.name}</span>
                        <span className="text-muted-foreground"> • Session {session.sessionNumber}</span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(session.scheduledAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </button>
              ))}
              {pastSessions.length > 5 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  And {pastSessions.length - 5} more past sessions
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Session Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-md">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Session with {selectedSession.team?.name}
                </DialogTitle>
                <DialogDescription>
                  Session {selectedSession.sessionNumber} of 3
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedSession)}
                  {selectedSession.confirmedByMentor && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      You confirmed this
                    </span>
                  )}
                </div>

                {/* Date & Time */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {format(new Date(selectedSession.scheduledAt), "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedSession.scheduledAt), "h:mm a")} • {selectedSession.durationMinutes} minutes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Question */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Question / Topic</h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                    {selectedSession.question}
                  </p>
                </div>

                {/* Notes if completed */}
                {selectedSession.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Session Notes</h4>
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                      {selectedSession.notes}
                    </p>
                  </div>
                )}

                {/* Action Items if any */}
                {selectedSession.actionItems && selectedSession.actionItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Action Items</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {selectedSession.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {/* Accept/Decline buttons for pending sessions */}
                {selectedSession.status === "scheduled" && (
                  <>
                    <Button
                      onClick={() => handleConfirm(selectedSession.id)}
                      disabled={confirmSession.isPending}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                      {confirmSession.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Accept Session
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeclineDialogOpen(true)}
                      className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </>
                )}
                {selectedSession.googleMeetLink && selectedSession.status === "confirmed" && isFuture(new Date(selectedSession.scheduledAt)) && (
                  <Button asChild className="w-full sm:w-auto">
                    <a
                      href={selectedSession.googleMeetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video className="mr-2 h-4 w-4" />
                      Join Google Meet
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={`/mentor/teams/${selectedSession.teamId}`}>
                    <Users className="mr-2 h-4 w-4" />
                    View Team
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Decline Session Request
            </DialogTitle>
            <DialogDescription>
              The team will be notified and can book a different time slot.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Reason (optional)
            </label>
            <Textarea
              placeholder="Let the team know why you can't make this time..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeclineDialogOpen(false);
                setDeclineReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={declineSession.isPending}
            >
              {declineSession.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Decline Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MentorLayout>
  );
}

export default function MentorCalendarPage() {
  return (
    <ProtectedRoute portal="mentor">
      <CalendarContent />
    </ProtectedRoute>
  );
}
