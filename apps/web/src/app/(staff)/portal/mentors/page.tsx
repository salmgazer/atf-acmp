"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useMentors,
  useMentorStatistics,
  useMentorEarningsSummary,
  useAllScheduledSessions,
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
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, isToday } from "date-fns";

const statusConfig: Record<
  MentorStatus,
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  imported: { label: "Imported", bgClass: "bg-muted", textClass: "text-muted-foreground", icon: Clock },
  active: { label: "Active", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  inactive: { label: "Inactive", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
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

const statusTabs: { value: MentorStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "imported", label: "Imported" },
  { value: "inactive", label: "Inactive" },
];

function MentorRow({ mentor }: { mentor: Mentor }) {
  const config = statusConfig[mentor.status];
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
    <tr className="border-b border-border/50 hover:bg-muted transition-colors">
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
            <Link
              href={`/portal/mentors/${mentor.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {mentor.firstName} {mentor.lastName}
            </Link>
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
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/portal/mentors/${mentor.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/portal/mentors/${mentor.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
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
                  href={`/portal/mentors/${session.mentor.id}`}
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
                  href={`/portal/teams/${session.team.id}`}
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
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<MentorStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

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

  const { data: mentorsData, isLoading } = useMentors({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    cohortId: effectiveCohortId,
    hasCapacity: capacityFilter === "all" ? undefined : capacityFilter === "available",
    page,
    limit: 20,
  });

  const { data: stats } = useMentorStatistics(effectiveCohortId);
  const { data: earningsSummary } = useMentorEarningsSummary(effectiveCohortId);
  const { data: allSessions, isLoading: isLoadingSessions } = useAllScheduledSessions({
    cohortId: effectiveCohortId,
  });

  const mentors = mentorsData?.data || [];
  const totalPages = mentorsData?.totalPages || 1;

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

        {/* List View */}
        {view === "list" && (
          <>
            {/* Search and Filter Toggle */}
            <div className="flex items-center gap-3">
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
              <Link
                href="/portal/mentors/import"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                Import
              </Link>
              <Link
                href="/portal/mentors/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
              >
                <UserPlus className="h-4 w-4" />
                Add Mentor
              </Link>
            </div>

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
                  <Link
                    href="/portal/mentors/import"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
                  >
                    Import CSV
                  </Link>
                  <Link
                    href="/portal/mentors/new"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    Add Mentor
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mentor</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Organization</th>
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
                        <MentorRow key={mentor.id} mentor={mentor} />
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
