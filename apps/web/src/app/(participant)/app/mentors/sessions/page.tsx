"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTeamClaimStatus,
  useClaimSessions,
  useBookSession,
  useUpdateSession,
  useCancelSession,
  useRateSession,
  MENTOR_CAPABILITY_LABELS,
  type ScheduledSession,
  type ScheduledSessionStatus,
} from "@/lib/api/hooks/use-mentors";
import { useMentorAvailableSlots } from "@/lib/api/hooks/use-mentor-availability";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import {
  Calendar,
  Clock,
  Video,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Star,
  ArrowLeft,
  ExternalLink,
  Edit,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { format, formatDistanceToNow, addDays, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SESSION_STATUS_CONFIG: Record<
  ScheduledSessionStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  scheduled: { label: "Pending", color: "text-amber-600 bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-green-600 bg-green-500/10 dark:bg-green-500/20 border-green-500/30", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-red-600 bg-red-500/10 dark:bg-red-500/20 border-red-500/30", icon: XCircle },
  completed: { label: "Completed", color: "text-muted-foreground bg-muted/50 dark:bg-muted/30 border-border", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-500/10 dark:bg-red-500/20 border-red-500/30", icon: XCircle },
  no_show: { label: "No Show", color: "text-orange-600 bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/30", icon: AlertCircle },
  rescheduled: { label: "Rescheduled", color: "text-purple-600 bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/30", icon: Clock },
};

function SessionCard({
  session,
  onEdit,
  onCancel,
  onRate,
}: {
  session: ScheduledSession;
  onEdit: () => void;
  onCancel: () => void;
  onRate: () => void;
}) {
  const statusConfig = SESSION_STATUS_CONFIG[session.status];
  const StatusIcon = statusConfig.icon;
  const sessionDate = new Date(session.scheduledAt);
  const isPast = isBefore(sessionDate, new Date());
  const isUpcoming = !isPast && session.status !== "cancelled" && session.status !== "completed";
  const canEdit = session.status === "scheduled" && !isPast;
  const canCancel = (session.status === "scheduled" || session.status === "confirmed") && !isPast;
  const canRate = session.status === "completed" && !session.rating;

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all",
      isPast ? "opacity-70" : "hover:shadow-lg hover:border-primary/30"
    )}>
      {/* Header */}
      <div className="px-5 py-4 border-b bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Session Number Badge */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20 shrink-0">
              <span className="text-lg font-bold text-primary">{session.sessionNumber}</span>
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">Session {session.sessionNumber}</h3>
                {/* Status Badge - Show "Confirmed" only when mentor has confirmed, otherwise show status */}
                {session.status === "confirmed" && session.confirmedByMentor ? (
                  <Badge variant="outline" className={cn("text-xs font-medium shrink-0", statusConfig.color)}>
                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                    Confirmed
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn("text-xs font-medium shrink-0", statusConfig.color)}>
                    <StatusIcon className="h-3 w-3 mr-1.5" />
                    {session.status === "confirmed" ? "Awaiting Mentor" : statusConfig.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{format(sessionDate, "EEE, MMM d, yyyy")}</span>
                <span className="text-muted-foreground/50">•</span>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{format(sessionDate, "h:mm a")}</span>
                <span className="text-muted-foreground/40">({session.durationMinutes}m)</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {(canEdit || canCancel || canRate) && (
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {canCancel && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onCancel}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {canRate && (
                <Button variant="outline" size="sm" className="h-8" onClick={onRate}>
                  <Star className="h-3.5 w-3.5 mr-1.5" />
                  Rate
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Question - Full Width */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <HelpCircle className="h-3.5 w-3.5" />
            Your Question
          </p>
          <p className="text-sm leading-relaxed">{session.question}</p>
        </div>

        {/* Google Meet Link */}
        {session.googleMeetLink && isUpcoming && (
          <Button asChild size="sm" className="w-full sm:w-auto">
            <a href={session.googleMeetLink} target="_blank" rel="noopener noreferrer">
              <Video className="h-4 w-4 mr-2" />
              Join Google Meet
              <ExternalLink className="h-3 w-3 ml-2 opacity-70" />
            </a>
          </Button>
        )}

        {/* Session Notes */}
        {session.notes && session.status === "completed" && (
          <div className="p-4 bg-green-500/5 dark:bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">Session Notes</p>
            <p className="text-sm text-green-900 dark:text-green-100 leading-relaxed">{session.notes}</p>
          </div>
        )}

        {/* Action Items */}
        {session.actionItems && session.actionItems.length > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Action Items</p>
            <ul className="space-y-2">
              {session.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mentor Feedback */}
        {session.mentorFeedback && (
          <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">Mentor Feedback</p>
            <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">{session.mentorFeedback}</p>
          </div>
        )}

        {/* Rating Display */}
        {session.rating && (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Rating:</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-4 w-4",
                    star <= session.rating! ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookSessionDialog({
  open,
  onClose,
  claimId,
  sessionNumber,
  mentorId,
}: {
  open: boolean;
  onClose: () => void;
  claimId: string;
  sessionNumber: number;
  mentorId: string;
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; startTime: string } | null>(null);
  const [question, setQuestion] = useState("");

  // Get available slots for the next 4 weeks
  const startDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const endDate = format(addDays(new Date(), 28), "yyyy-MM-dd");

  const { data: slotsData, isLoading: slotsLoading } = useMentorAvailableSlots(
    mentorId,
    startDate,
    endDate
  );

  const bookMutation = useBookSession();

  const handleSubmit = async () => {
    if (!selectedSlot || !question.trim()) {
      toast.error("Please select a time slot and provide your question");
      return;
    }

    try {
      await bookMutation.mutateAsync({
        claimId,
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        question: question.trim(),
      });
      toast.success("Session booked! Your mentor will receive a calendar invite.");
      onClose();
      setSelectedDate("");
      setSelectedSlot(null);
      setQuestion("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Failed to book session");
    }
  };

  // Get unique dates that have available slots
  const availableDates = slotsData?.slots
    ? [...new Set(slotsData.slots.filter(s => s.isAvailable).map(s => s.date))]
    : [];

  // Get available slots for selected date
  const slotsForSelectedDate = selectedDate
    ? slotsData?.slotsByDate?.[selectedDate]?.filter(s => s.isAvailable) || []
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Book Session {sessionNumber}</DialogTitle>
          <DialogDescription>
            Select an available time slot from your mentor's schedule. Your mentor will receive a
            calendar invite with Google Meet link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Select a Date *</Label>
            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading available times...</span>
              </div>
            ) : availableDates.length === 0 ? (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-yellow-800">
                  Your mentor hasn't set up their availability yet, or all slots are booked.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please contact your mentor to request availability.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto">
                {availableDates.map(date => {
                  const dateObj = new Date(date);
                  const isSelected = selectedDate === date;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                      className={cn(
                        "p-2 rounded-lg border text-center transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      )}
                    >
                      <p className="text-xs text-muted-foreground">
                        {format(dateObj, "EEE")}
                      </p>
                      <p className="font-medium">
                        {format(dateObj, "MMM d")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Slot Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label>Select a Time *</Label>
              {slotsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No available slots for this date
                </p>
              ) : (
              <div className="flex gap-2 overflow-x-auto pb-2">
                  {slotsForSelectedDate.map(slot => {
                    const isSelected =
                      selectedSlot?.date === slot.date &&
                      selectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={`${slot.date}-${slot.startTime}`}
                        type="button"
                        onClick={() =>
                          setSelectedSlot({ date: slot.date, startTime: slot.startTime })
                        }
                        className={cn(
                          "p-2 rounded-lg border text-center transition-colors shrink-0 min-w-[80px]",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        <p className="font-medium">{slot.startTime}</p>
                        <p className="text-xs text-muted-foreground">
                          {slot.durationMinutes} min
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Question Input */}
          <div className="space-y-2">
            <Label htmlFor="question">
              Your Question / Topic *
              <span className="text-xs text-muted-foreground ml-2">
                (Be specific about what you want to discuss)
              </span>
            </Label>
            <Textarea
              id="question"
              placeholder="e.g., I need help optimizing our RAG pipeline for better retrieval accuracy. We're seeing high latency and low relevance scores..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {question.length}/1000 characters (minimum 10)
            </p>
          </div>

          {selectedSlot && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 inline mr-2" />
              Selected: {format(new Date(selectedSlot.date), "EEEE, MMMM d, yyyy")} at{" "}
              {selectedSlot.startTime}
            </div>
          )}

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
            <MessageSquare className="h-4 w-4 inline mr-2" />
            Your mentor will see this question when reviewing the session request.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bookMutation.isPending || !selectedSlot || question.length < 10}
          >
            {bookMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="mr-2 h-4 w-4" />
            )}
            Book Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelSessionDialog({
  open,
  onClose,
  session,
  claimId,
}: {
  open: boolean;
  onClose: () => void;
  session: ScheduledSession | null;
  claimId: string;
}) {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelSession();

  const handleCancel = async () => {
    if (!session || !reason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    try {
      await cancelMutation.mutateAsync({
        claimId,
        sessionId: session.id,
        reason: reason.trim(),
      });
      toast.success("Session cancelled");
      onClose();
      setReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel session");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Session</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel Session {session?.sessionNumber}? Your mentor will be
            notified.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="reason">Reason for cancellation *</Label>
          <Textarea
            id="reason"
            placeholder="Please explain why you need to cancel..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-2"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep Session
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelMutation.isPending || reason.length < 5}
          >
            {cancelMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Cancel Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateSessionDialog({
  open,
  onClose,
  session,
  claimId,
}: {
  open: boolean;
  onClose: () => void;
  session: ScheduledSession | null;
  claimId: string;
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);

  const rateMutation = useRateSession();

  const handleSubmit = async () => {
    if (!session || rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    try {
      await rateMutation.mutateAsync({
        claimId,
        sessionId: session.id,
        rating,
        teamFeedback: feedback.trim() || undefined,
      });
      toast.success("Thank you for your feedback!");
      onClose();
      setRating(0);
      setFeedback("");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit rating");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Session {session?.sessionNumber}</DialogTitle>
          <DialogDescription>
            How was your session with your mentor? Your feedback helps improve the program.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">Select a rating</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      star <= (hoveredRating || rating)
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300"
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Feedback (optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Share any additional thoughts about the session..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={rateMutation.isPending || rating === 0}>
            {rateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Star className="mr-2 h-4 w-4" />
            )}
            Submit Rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionsPageContent() {
  const router = useRouter();
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);

  const { data: participant } = useCurrentParticipant();
  const { data: claimStatus, isLoading: claimLoading } = useTeamClaimStatus();

  const claimId = claimStatus?.claim?.id;
  const { data: sessions, isLoading: sessionsLoading } = useClaimSessions(claimId || "");

  const isLoading = claimLoading || sessionsLoading;

  // If no claim, redirect to mentors page
  if (!claimLoading && !claimStatus?.hasClaim) {
    return (
      <ParticipantLayout>
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No Mentor Claimed</h2>
          <p className="text-muted-foreground mt-2">
            You need to claim a mentor before you can book sessions.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/mentors">Find a Mentor</Link>
          </Button>
        </div>
      </ParticipantLayout>
    );
  }

  const mentor = claimStatus?.claim?.mentor;
  const sessionsBooked = sessions?.filter((s) => s.status !== "cancelled" && s.status !== "declined").length || 0;
  const nextSessionNumber = sessionsBooked + 1;
  const canBookMore = sessionsBooked < 3;

  // Sort sessions: upcoming first, then by date
  const sortedSessions = [...(sessions || [])].sort((a, b) => {
    const aDate = new Date(a.scheduledAt);
    const bDate = new Date(b.scheduledAt);
    const now = new Date();

    // Upcoming sessions first
    const aUpcoming = isAfter(aDate, now) && a.status !== "cancelled" && a.status !== "completed";
    const bUpcoming = isAfter(bDate, now) && b.status !== "cancelled" && b.status !== "completed";

    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;

    // Then by date
    return bDate.getTime() - aDate.getTime();
  });

  const upcomingSessions = sortedSessions.filter(
    (s) =>
      isAfter(new Date(s.scheduledAt), new Date()) &&
      s.status !== "cancelled" &&
      s.status !== "completed"
  );

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/app/mentors")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        {/* Mentor Info Card */}
        {mentor && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                {mentor.profileImageUrl ? (
                  <img
                    src={mentor.profileImageUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="font-medium">
                    {mentor.firstName[0]}
                    {mentor.lastName[0]}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold">
                  Sessions with {mentor.firstName} {mentor.lastName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mentor.title}
                  {mentor.company && ` • ${mentor.company}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{sessionsBooked}/3</p>
                <p className="text-xs text-muted-foreground">sessions booked</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {canBookMore && (
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div>
              <p className="font-medium">Ready for your next session?</p>
              <p className="text-sm text-muted-foreground">
                You have {3 - sessionsBooked} session{3 - sessionsBooked !== 1 ? "s" : ""} remaining
              </p>
            </div>
            <Button onClick={() => setShowBookDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Book Session {nextSessionNumber}
            </Button>
          </div>
        )}

        {/* Sessions List */}
        <div>
          <h2 className="font-semibold mb-4">
            {upcomingSessions.length > 0 ? "Your Sessions" : "Session History"}
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sortedSessions.length > 0 ? (
            <div className="space-y-4">
              {sortedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onEdit={() => {
                    setSelectedSession(session);
                    // TODO: Implement edit dialog
                    toast.info("Edit functionality coming soon");
                  }}
                  onCancel={() => {
                    setSelectedSession(session);
                    setShowCancelDialog(true);
                  }}
                  onRate={() => {
                    setSelectedSession(session);
                    setShowRateDialog(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No sessions booked yet</p>
              <Button className="mt-4" onClick={() => setShowBookDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Book Your First Session
              </Button>
            </div>
          )}
        </div>

        {/* All 3 sessions completed */}
        {!canBookMore && sessionsBooked === 3 && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
            <p className="font-medium text-green-800 mt-2">All Sessions Complete!</p>
            <p className="text-sm text-green-700">
              You've completed all 3 mentoring sessions. Great job!
            </p>
          </div>
        )}

        {/* Book Session Dialog */}
        {claimId && mentor && (
          <BookSessionDialog
            open={showBookDialog}
            onClose={() => setShowBookDialog(false)}
            claimId={claimId}
            sessionNumber={nextSessionNumber}
            mentorId={mentor.id}
          />
        )}

        {/* Cancel Session Dialog */}
        {claimId && (
          <CancelSessionDialog
            open={showCancelDialog}
            onClose={() => {
              setShowCancelDialog(false);
              setSelectedSession(null);
            }}
            session={selectedSession}
            claimId={claimId}
          />
        )}

        {/* Rate Session Dialog */}
        {claimId && (
          <RateSessionDialog
            open={showRateDialog}
            onClose={() => {
              setShowRateDialog(false);
              setSelectedSession(null);
            }}
            session={selectedSession}
            claimId={claimId}
          />
        )}
      </div>
    </ParticipantLayout>
  );
}

export default function SessionsPage() {
  return (
    <ProtectedRoute portal="participant">
      <SessionsPageContent />
    </ProtectedRoute>
  );
}
