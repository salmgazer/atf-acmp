"use client";

import { StaffOnly, useStaffPermission } from "@/components/auth/staff-only";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isAxiosError } from "axios";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useMentors,
  useMentorStatistics,
  useMentorEarningsSummary,
  useAllScheduledSessions,
  useDeleteMentor,
  useRestoreMentor,
  useResendMentorInvite,
  useResendMentorInvites,
  useMentorInviteBatch,
  type MentorBulkInviteRequest,
  type Mentor,
  type MentorStatus,
  type ScheduledSession,
  type ScheduledSessionStatus,
} from "@/lib/api/hooks/use-mentors";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import {
  Search,
  UserPlus,
  Eye,
  Loader2,
  GraduationCap,
  Building2,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  Download,
  SlidersHorizontal,
  X,
  MoreHorizontal,
  Pencil,
  DollarSign,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Video,
  Users,
  HelpCircle,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, isToday } from "date-fns";

const statusConfig: Record<
  MentorStatus | "deleted",
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  imported: { label: "Imported", bgClass: "bg-muted", textClass: "text-muted-foreground", icon: Clock },
  active: { label: "Active", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  inactive: { label: "Inactive", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
  deleted: { label: "Deleted", bgClass: "bg-zinc-500/15", textClass: "text-zinc-500", icon: Trash2 },
};

const sessionStatusConfig: Record<
  ScheduledSessionStatus,
  { label: string; bgClass: string; textClass: string }
> = {
  scheduled: { label: "Pending", bgClass: "bg-yellow-500/15", textClass: "text-yellow-600" },
  confirmed: { label: "Confirmed", bgClass: "bg-blue-500/15", textClass: "text-blue-600" },
  declined: { label: "Declined", bgClass: "bg-red-500/15", textClass: "text-red-600" },
  completed: { label: "Completed", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600" },
  cancelled: { label: "Cancelled", bgClass: "bg-muted", textClass: "text-muted-foreground" },
  no_show: { label: "No Show", bgClass: "bg-orange-500/15", textClass: "text-orange-600" },
  rescheduled: { label: "Rescheduled", bgClass: "bg-purple-500/15", textClass: "text-purple-600" },
};

const statusTabs: { value: MentorStatus | "all" | "deleted"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "imported", label: "Imported" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
];

function MentorRow({
  mentor,
  isDeleted,
  onDelete,
  onRestore,
  selected,
  onSelect,
  bulkBusy,
}: {
  mentor: Mentor;
  isDeleted?: boolean;
  onDelete: (mentor: Mentor) => void;
  onRestore: (mentor: Mentor) => void;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  bulkBusy: boolean;
}) {
  const resendInvite = useResendMentorInvite();
  const config = isDeleted ? statusConfig.deleted : statusConfig[mentor.status];
  const StatusIcon = config.icon;
  const confirmedSessions = mentor.confirmedSessions || 0;
  const completedSessions = mentor.completedSessions || 0;
  const unpaidAmount = mentor.unpaidAmount || 0;

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <tr className={`border-b border-border/50 hover:bg-muted transition-colors ${isDeleted ? "opacity-60" : ""}`}>
      <StaffOnly permission="manage"><td className="p-4">
        <Checkbox aria-label={`Select ${mentor.firstName} ${mentor.lastName}`} checked={selected}
          disabled={bulkBusy || isDeleted || mentor.status !== "imported"} onCheckedChange={checked => onSelect(checked === true)} />
      </td></StaffOnly>
      <td className="p-4">
        <div className="flex items-center gap-3">
          {mentor.profileImageUrl ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <img
                src={mentor.profileImageUrl}
                alt={`${mentor.firstName} ${mentor.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">
                {mentor.firstName[0]}
                {mentor.lastName[0]}
              </span>
            </div>
          )}
          <div>
            {isDeleted ? (
              <span className="font-medium text-muted-foreground">
                {mentor.firstName} {mentor.lastName}
              </span>
            ) : (
              <Link
                href={`/staff/mentors/${mentor.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {mentor.firstName} {mentor.lastName}
              </Link>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {mentor.email}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4">
        {mentor.company ? (
          <div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {mentor.company}
            </div>
            {mentor.title && (
              <div className="text-xs text-muted-foreground">{mentor.title}</div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </td>
      <td className="p-4">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {mentor.expertise.slice(0, 3).map((skill) => (
            <span key={skill} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {skill}
            </span>
          ))}
          {mentor.expertise.length > 3 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              +{mentor.expertise.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {confirmedSessions}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-emerald-600">
            {completedSessions}
          </span>
          <span className="text-xs text-muted-foreground">completed</span>
        </div>
      </td>
      <td className="p-4">
        {unpaidAmount > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
            <DollarSign className="h-3 w-3" />
            {formatCurrency(unpaidAmount)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(mentor.createdAt), "MMM d, yyyy")}
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${mentor.firstName} ${mentor.lastName}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isDeleted ? (
              <StaffOnly permission="manage"><DropdownMenuItem onClick={() => onRestore(mentor)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem></StaffOnly>
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/staff/mentors/${mentor.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </DropdownMenuItem>
                <StaffOnly permission="manage"><DropdownMenuItem asChild>
                  <Link href={`/staff/mentors/${mentor.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem></StaffOnly>
                {mentor.status === "imported" && <StaffOnly permission="manage"><DropdownMenuItem
                  disabled={bulkBusy || resendInvite.isPending} onClick={() => resendInvite.mutate(mentor.id)}>
                  {resendInvite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Resend Invite
                </DropdownMenuItem></StaffOnly>}
                <DropdownMenuSeparator />
                <StaffOnly permission="manage"><DropdownMenuItem
                  onClick={() => onDelete(mentor)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem></StaffOnly>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// Session Detail Modal Component
function SessionDetailModal({
  session,
  open,
  onClose,
}: {
  session: ScheduledSession | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!session) return null;

  const statusConf = sessionStatusConfig[session.status];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Session Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConf.bgClass} ${statusConf.textClass}`}>
              {statusConf.label}
            </span>
            {session.confirmedByMentor && session.status !== "completed" && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-600">
                Mentor Confirmed
              </span>
            )}
          </div>

          {/* Date & Time */}
          <div className="rounded-lg border border-border p-3 bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Calendar className="h-4 w-4" />
              {format(parseISO(session.scheduledAt as unknown as string), "EEEE, MMMM d, yyyy")}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {format(parseISO(session.scheduledAt as unknown as string), "h:mm a")} · {session.durationMinutes} minutes
            </div>
          </div>

          {/* Mentor & Team */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground mb-1">Mentor</div>
              {session.mentor ? (
                <Link
                  href={`/staff/mentors/${session.mentor.id}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {session.mentor.firstName} {session.mentor.lastName}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground mb-1">Team</div>
              {session.team ? (
                <Link
                  href={`/staff/teams/${session.team.id}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {session.team.name}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </div>

          {/* Question */}
          {session.question && (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <HelpCircle className="h-3 w-3" />
                Question
              </div>
              <p className="text-sm text-foreground">{session.question}</p>
            </div>
          )}

          {/* Google Meet Link */}
          {session.googleMeetLink && (
            <a
              href={session.googleMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium justify-center"
            >
              <Video className="h-4 w-4" />
              Join Google Meet
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Google Calendar Link */}
          {session.googleCalendarLink && (
            <a
              href={session.googleCalendarLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium justify-center"
            >
              <Calendar className="h-4 w-4" />
              View in Google Calendar
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Notes (if completed) */}
          {session.notes && (
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground mb-1">Notes</div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}

          {/* Decline Reason */}
          {session.declineReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-3">
              <div className="text-xs text-red-600 mb-1">Decline Reason</div>
              <p className="text-sm text-red-700 dark:text-red-400">{session.declineReason}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Calendar View Component
function CalendarView({
  sessions,
  isLoading,
}: {
  sessions: ScheduledSession[];
  isLoading: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Group days into weeks (arrays of 7)
    const weeksArray: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArray.push(days.slice(i, i + 7));
    }
    return weeksArray;
  }, [currentMonth]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, ScheduledSession[]>();
    sessions.forEach((session) => {
      const dateKey = format(parseISO(session.scheduledAt as unknown as string), "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, session]);
    });
    return map;
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Calendar Table */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <th key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border w-[14.28%]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIdx) => (
              <tr key={weekIdx}>
                {week.map((day, dayIdx) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const daySessions = sessionsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isCurrentDay = isToday(day);

                  return (
                    <td
                      key={dayIdx}
                      className={`h-[100px] border border-border p-1 align-top ${
                        !isCurrentMonth ? "bg-muted/30" : ""
                      } ${isCurrentDay ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                    >
                      <div
                        className={`text-xs font-medium p-1 ${
                          !isCurrentMonth
                            ? "text-muted-foreground/50"
                            : isCurrentDay
                            ? "text-blue-600"
                            : "text-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {daySessions.slice(0, 3).map((session) => {
                          const statusConf = sessionStatusConfig[session.status];
                          return (
                            <button
                              key={session.id}
                              onClick={() => setSelectedSession(session)}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate ${statusConf.bgClass} ${statusConf.textClass} hover:opacity-80 transition-opacity`}
                            >
                              {format(parseISO(session.scheduledAt as unknown as string), "h:mm a")} - {session.mentor?.firstName?.[0]}.{session.mentor?.lastName?.[0]}
                            </button>
                          );
                        })}
                        {daySessions.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{daySessions.length - 3} more
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Session Detail Modal */}
      <SessionDetailModal
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </>
  );
}

function MentorsContent() {
  const canManage = useStaffPermission("manage");
  const userId = useAuthStore(state => state.user?.id);
  const batchStorageKey = userId ? `acmp-mentor-invite-batch:${userId}` : null;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<"selected" | "imported" | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const resendBulk = useResendMentorInvites();
  const { data: batch, isError: batchError, error: batchFailure, refetch: refreshBatch } = useMentorInviteBatch(canManage ? batchId : null);
  const bulkBusy = resendBulk.isPending || (!!batchId && (!batch || ["queued", "active"].includes(batch.state)));

  useEffect(() => {
    if (!canManage || !batchStorageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(batchStorageKey) || "null");
      if (saved?.id && saved.createdAt > Date.now() - 86400000) setBatchId(saved.id);
      else sessionStorage.removeItem(batchStorageKey);
    } catch { /* Optional progress cache. */ }
  }, [canManage, batchStorageKey]);
  useEffect(() => {
    if (isAxiosError(batchFailure) && batchFailure.response?.status === 404) {
      setBatchId(null);
      if (batchStorageKey) try { sessionStorage.removeItem(batchStorageKey); } catch { /* Optional cache. */ }
    }
  }, [batchFailure, batchStorageKey]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<MentorStatus | "all" | "deleted">("all");
  const [search, setSearch] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mentorToDelete, setMentorToDelete] = useState<Mentor | null>(null);
  const [mentorToRestore, setMentorToRestore] = useState<Mentor | null>(null);

  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  useEffect(() => {
    if (globalCohortId && !hasInitialized) {
      setSelectedCohortId(null);
      setHasInitialized(true);
    }
  }, [globalCohortId, hasInitialized]);

  const effectiveCohortId = selectedCohortId ?? globalCohortId ?? undefined;

  // Determine if we're showing deleted mentors
  const isShowingDeleted = statusFilter === "deleted";

  const { data: mentorsData, isLoading } = useMentors({
    status: statusFilter === "all" || statusFilter === "deleted" ? undefined : statusFilter,
    search: search || undefined,
    cohortId: effectiveCohortId,
    hasCapacity: capacityFilter === "all" ? undefined : capacityFilter === "available",
    deleted: isShowingDeleted ? true : undefined,
    page,
    limit: 20,
  });

  const { data: stats } = useMentorStatistics(effectiveCohortId);
  const { data: earningsSummary } = useMentorEarningsSummary(effectiveCohortId);
  const { data: allSessions, isLoading: isLoadingSessions } = useAllScheduledSessions({
    cohortId: effectiveCohortId,
  });

  const deleteMutation = useDeleteMentor();
  const restoreMutation = useRestoreMentor();

  const mentors = mentorsData?.data || [];
  const totalPages = mentorsData?.totalPages || 1;
  const selectable = isShowingDeleted ? [] : mentors.filter(mentor => mentor.status === "imported");
  const allSelected = selectable.length > 0 && selectable.every(mentor => selectedIds.includes(mentor.id));
  const someSelected = selectable.some(mentor => selectedIds.includes(mentor.id));
  const cohortName = cohorts.find(cohort => cohort.id === effectiveCohortId)?.name;

  useEffect(() => { setSelectedIds([]); setConfirmation(null); }, [page, effectiveCohortId, statusFilter, search, capacityFilter, view, canManage]);

  const queueInvites = async (request: MentorBulkInviteRequest) => {
    try {
      const queued = await resendBulk.mutateAsync(request);
      setBatchId(queued.id);
      if (batchStorageKey) try { sessionStorage.setItem(batchStorageKey, JSON.stringify({ id: queued.id, createdAt: Date.now() })); } catch { /* Optional progress cache. */ }
      setSelectedIds([]);
      setConfirmation(null);
    } catch { /* The mutation displays the error; preserve selection for correction. */ }
  };
  const confirmResend = () => {
    if (confirmation === "selected") return queueInvites({ mode: "selected", mentorIds: selectedIds });
    if (confirmation === "imported" && effectiveCohortId && !isShowingDeleted) return queueInvites({ mode: "imported", filters: {
      cohortId: effectiveCohortId, search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      hasCapacity: capacityFilter === "all" ? undefined : capacityFilter === "available",
    } });
  };

  const activeFilterCount = [
    statusFilter !== "all",
    selectedCohortId !== null && selectedCohortId !== globalCohortId,
    capacityFilter !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setStatusFilter("all");
    setSelectedCohortId(null);
    setCapacityFilter("all");
    setPage(1);
  };

  const handleDelete = async () => {
    if (!mentorToDelete) return;
    try {
      await deleteMutation.mutateAsync(mentorToDelete.id);
      toast.success(`${mentorToDelete.firstName} ${mentorToDelete.lastName} has been deleted`);
      setMentorToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete mentor");
    }
  };

  const handleRestore = async () => {
    if (!mentorToRestore) return;
    try {
      await restoreMutation.mutateAsync(mentorToRestore.id);
      toast.success(`${mentorToRestore.firstName} ${mentorToRestore.lastName} has been restored`);
      setMentorToRestore(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to restore mentor");
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (effectiveCohortId) params.set("cohortId", effectiveCohortId);
      if (capacityFilter !== "all") params.set("hasCapacity", capacityFilter === "available" ? "true" : "false");
      params.set("limit", "10000");

      const response = await api.get<{ data: Mentor[] }>(`/mentors?${params.toString()}`);
      const allMentors = response.data;

      if (allMentors.length === 0) {
        toast.error("No mentors to export");
        return;
      }

      const headers = [
        "Email",
        "First Name",
        "Last Name",
        "Phone",
        "Company",
        "Title",
        "Expertise",
        "LinkedIn URL",
        "Max Teams",
        "Status",
        "Session Rate Override",
        "Confirmed Sessions",
        "Completed Sessions",
        "Unpaid Amount",
        "Created At",
      ];

      const rows = allMentors.map((m) => [
        m.email,
        m.firstName,
        m.lastName,
        m.phone || "",
        m.company || "",
        m.title || "",
        (m.expertise || []).join("; "),
        m.linkedinUrl || "",
        String(m.maxTeams),
        m.status,
        m.sessionRateOverride !== null && m.sessionRateOverride !== undefined ? String(m.sessionRateOverride) : "",
        String(m.confirmedSessions || 0),
        String(m.completedSessions || 0),
        String(m.unpaidAmount || 0),
        format(new Date(m.createdAt), "yyyy-MM-dd HH:mm:ss"),
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cohortName = cohorts.find((c) => c.id === effectiveCohortId)?.name || "all";
      const timestamp = format(new Date(), "yyyy-MM-dd");
      link.download = `mentors_${cohortName.replace(/\s+/g, "_")}_${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allMentors.length} mentors`);
    } catch (error: any) {
      toast.error(error.message || "Failed to export mentors");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Mentors</h1>
            <p className="text-sm text-muted-foreground">
              Manage mentors, assignments, and sessions
            </p>
          </div>
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === "list"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === "calendar"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.total || 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">
              {stats?.active || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Teams Assigned</div>
            <div className="mt-1 text-2xl font-semibold text-blue-600">
              {stats?.assignedTeams || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Available Slots</div>
            <div className="mt-1 text-2xl font-semibold text-purple-600">
              {stats?.availableSlots || 0}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Session Hours</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{stats?.totalSessionHours || 0}h</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              Total Unpaid
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(earningsSummary?.totalUnpaid || 0)}
            </div>
          </div>
        </div>

        <StaffOnly permission="manage">{batchId && <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-border p-4">
          <p className="font-medium">{batch?.state === "completed" ? "Mentor invitation resend complete" : batch?.state === "failed" ? "Mentor invitation resend stopped" : "Resending mentor invitations"}</p>
          {batch && <p className="text-sm text-muted-foreground">{batch.processed} of {batch.total} processed · {batch.sent} sent · {batch.failed} failed · {batch.skipped} skipped</p>}
          {batch?.error && <p className="text-sm text-destructive">{batch.error}</p>}
          {!!batch?.failed && <p className="text-sm text-destructive">Failed mentors: {batch.failures.map(failure => failure.email).join(", ")}{batch.failed > batch.failures.length ? " (first 100 shown)" : ""}</p>}
          {batchError && <div className="flex items-center gap-3"><p className="text-sm text-destructive">Could not load progress.</p><Button size="sm" variant="outline" onClick={() => refreshBatch()}>Refresh progress</Button></div>}
        </div>}</StaffOnly>

        {/* List View */}
        {view === "list" && (
          <>
            {/* Search and Filter Toggle */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search mentors..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 pl-11 pr-4 text-sm bg-transparent border border-border rounded-full focus:border-zinc-400 focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="flex items-center justify-center w-5 h-5 text-xs rounded-full bg-card text-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </button>
              <StaffOnly permission="manage"><Link
                href="/staff/mentors/import"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                Import
              </Link></StaffOnly>
              <StaffOnly permission="manage"><Button variant="outline"
                disabled={!effectiveCohortId || bulkBusy || (statusFilter !== "all" && statusFilter !== "imported")}
                onClick={() => setConfirmation("imported")}><Mail className="mr-2 h-4 w-4" />Resend imported invites</Button></StaffOnly>
              <StaffOnly permission="manage"><Link
                href="/staff/mentors/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
              >
                <UserPlus className="h-4 w-4" />
                Add Mentor
              </Link></StaffOnly>
            </div>

            <StaffOnly permission="manage">{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
              <span className="text-sm font-medium">{selectedIds.length} selected on this page</span>
              <Button size="sm" disabled={bulkBusy} onClick={() => setConfirmation("selected")}><Mail className="mr-2 h-4 w-4" />Resend selected invites</Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>Clear selection</Button>
            </div>}</StaffOnly>

            {/* Collapsible Filter Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted border border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <div className="flex flex-wrap gap-1">
                    {statusTabs.map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => {
                          setStatusFilter(tab.value);
                          setPage(1);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          statusFilter === tab.value
                            ? "bg-zinc-900 text-white"
                            : "bg-card text-muted-foreground border border-border hover:bg-muted"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Cohort:</span>
                  <select
                    value={selectedCohortId ?? globalCohortId ?? ""}
                    onChange={(e) => {
                      setSelectedCohortId(e.target.value || null);
                      setPage(1);
                    }}
                    className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                  >
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Capacity:</span>
                  <select
                    value={capacityFilter}
                    onChange={(e) => {
                      setCapacityFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                  >
                    <option value="all">All Mentors</option>
                    <option value="available">Has Capacity</option>
                    <option value="full">At Capacity</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Clear all
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : mentors.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted">
                  <GraduationCap className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-foreground">No mentors found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search
                    ? "No mentors match your search criteria."
                    : "Import or add mentors to get started."}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <StaffOnly permission="manage"><Link
                    href="/staff/mentors/import"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
                  >
                    Import CSV
                  </Link></StaffOnly>
                  <StaffOnly permission="manage"><Link
                    href="/staff/mentors/new"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    Add Mentor
                  </Link></StaffOnly>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-card overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <StaffOnly permission="manage"><th className="p-4 w-12">
                          <Checkbox aria-label="Select all imported mentors on this page" checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            disabled={bulkBusy || !selectable.length} onCheckedChange={checked => setSelectedIds(checked === true ? selectable.map(mentor => mentor.id) : [])} />
                        </th></StaffOnly>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mentor</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Partner</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Expertise</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Sessions</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Unpaid</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Added</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mentors.map((mentor) => (
                        <MentorRow
                          key={mentor.id}
                          mentor={mentor}
                          isDeleted={isShowingDeleted}
                          onDelete={setMentorToDelete}
                          onRestore={setMentorToRestore}
                          selected={selectedIds.includes(mentor.id)} bulkBusy={bulkBusy}
                          onSelect={checked => setSelectedIds(ids => checked ? [...new Set([...ids, mentor.id])] : ids.filter(id => id !== mentor.id))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages} ({mentorsData?.total} total)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Calendar View */}
        {view === "calendar" && (
          <CalendarView sessions={allSessions || []} isLoading={isLoadingSessions} />
        )}
      </div>

      <StaffOnly permission="manage"><Dialog open={confirmation !== null} onOpenChange={open => { if (!open && !resendBulk.isPending) setConfirmation(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{confirmation === "selected" ? "Resend selected mentor invites?" : "Resend imported mentor invites?"}</DialogTitle>
            <DialogDescription>{confirmation === "selected" ? `Send invitations to ${selectedIds.length} selected imported mentor${selectedIds.length === 1 ? "" : "s"}?`
              : `Send invitations to all imported mentors in ${cohortName || "the selected cohort"} matching the current filters, across all pages?`}</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground">Only imported, non-deleted mentors receive invitations. Each invitation uses the mentor’s current email address.</p>
          <DialogFooter><Button variant="outline" disabled={resendBulk.isPending} onClick={() => setConfirmation(null)}>Cancel</Button>
            <Button disabled={bulkBusy || (confirmation === "selected" && !selectedIds.length)} onClick={confirmResend}>
              {resendBulk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send invitations
            </Button></DialogFooter>
        </DialogContent>
      </Dialog></StaffOnly>

      {/* Delete Confirmation Dialog */}
      <StaffOnly permission="manage"><AlertDialog open={!!mentorToDelete} onOpenChange={() => setMentorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mentor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {mentorToDelete?.firstName} {mentorToDelete?.lastName}
              </span>
              ? This mentor can be restored later from the Deleted filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog></StaffOnly>

      {/* Restore Confirmation Dialog */}
      <StaffOnly permission="manage"><AlertDialog open={!!mentorToRestore} onOpenChange={() => setMentorToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Mentor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore{" "}
              <span className="font-medium text-foreground">
                {mentorToRestore?.firstName} {mentorToRestore?.lastName}
              </span>
              ? They will be set to &quot;Imported&quot; status and can log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog></StaffOnly>
    </StaffLayout>
  );
}

export default function MentorsPage() {
  return (
    <ProtectedRoute portal="staff">
      <MentorsContent />
    </ProtectedRoute>
  );
}
