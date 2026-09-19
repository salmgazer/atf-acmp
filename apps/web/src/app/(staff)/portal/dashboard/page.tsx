"use client";

import { useMemo } from "react";
import { StaffLayout } from "@/components/layouts";
import { ActiveCohortCard, NoCohortCard, LineChart, BarChart } from "@/components/dashboard";
import { useCohort, useCohortStatistics } from "@/lib/api/hooks/use-cohorts";
import { useTeamStatistics } from "@/lib/api/hooks/use-teams";
import { useBriefStatistics } from "@/lib/api/hooks/use-briefs";
import { useMentorStatistics } from "@/lib/api/hooks/use-mentors";
import { useHourlyActivity, useWeeklyActivity } from "@/lib/api/hooks/use-activity";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  Users,
  FileText,
  Loader2,
  GraduationCap,
  Activity,
  TrendingUp,
  MoreVertical,
  BarChart3,
  TrendingUp as LineChartIcon,
} from "lucide-react";

// Empty chart placeholder
function EmptyChart({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl bg-card p-5 border border-border">
      <div className="mb-4">
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
        <Icon className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-xs">No data available</p>
      </div>
    </div>
  );
}

// Mini stat item for lists - monochrome
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// Stat card like Luxe AI
function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  trend 
}: { 
  icon: React.ElementType;
  title: string; 
  value: string | number;
  trend?: string;
}) {
  return (
    <div className="rounded-xl bg-card p-5 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{title}</span>
        </div>
        <button className="text-muted-foreground hover:text-muted-foreground">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground">{value}</span>
        {trend && (
          <span className="text-xs text-emerald-600 flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const { user } = useAuthStore();
  
  // Get global cohort from store (set by sidebar)
  const globalCohortId = useStaffCohortStore((state) => state.globalCohortId);
  
  // Fetch the selected cohort data
  const { data: selectedCohort, isLoading: isLoadingCohort } = useCohort(globalCohortId || "");
  
  const { data: statistics, isLoading: isLoadingStats } = useCohortStatistics(
    globalCohortId || ""
  );
  const { data: teamStats } = useTeamStatistics(globalCohortId || undefined);
  const { data: briefStats } = useBriefStatistics(globalCohortId || undefined);
  const { data: mentorStats } = useMentorStatistics(globalCohortId || undefined);
  
  // Activity data for charts - filtered by selected cohort
  const activityParams = globalCohortId ? { cohortId: globalCohortId } : undefined;
  const { data: hourlyActivity, isLoading: isLoadingHourly } = useHourlyActivity(activityParams);
  const { data: weeklyActivity, isLoading: isLoadingWeekly } = useWeeklyActivity(activityParams);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Transform hourly data for chart
  const hourlyChartData = useMemo(() => {
    if (!hourlyActivity?.data) return [];
    return hourlyActivity.data.map((point) => ({
      hour: `${point.hour.toString().padStart(2, '0')}:00`,
      requests: point.count,
      users: point.uniqueUsers,
    }));
  }, [hourlyActivity?.data]);

  // Transform weekly data for chart
  const weeklyChartData = useMemo(() => {
    if (!weeklyActivity?.data) return [];
    return weeklyActivity.data.map((point) => ({
      day: point.dayName.substring(0, 3), // Mon, Tue, etc.
      requests: point.count,
      users: point.uniqueUsers,
    }));
  }, [weeklyActivity?.data]);

  // Team status data
  const teamStatusData = teamStats ? {
    forming: teamStats.forming || 0,
    active: teamStats.active || 0,
    submitted: teamStats.submitted || 0,
  } : { forming: 0, active: 0, submitted: 0 };
  
  const totalTeams = teamStatusData.forming + teamStatusData.active + teamStatusData.submitted;

  // Brief status data
  const briefStatusData = briefStats ? {
    draft: briefStats.draft || 0,
    inReview: briefStats.inReview || 0,
    approved: briefStats.approved || 0,
    rejected: briefStats.rejected || 0,
  } : { draft: 0, inReview: 0, approved: 0, rejected: 0 };

  // Mentor capacity data
  const mentorCapacity = mentorStats ? {
    total: mentorStats.total || 0,
    active: mentorStats.active || 0,
    availableSlots: mentorStats.availableSlots || 0,
    assignedTeams: mentorStats.assignedTeams || 0,
  } : { total: 0, active: 0, availableSlots: 0, assignedTeams: 0 };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {getGreeting()}, {user?.firstName || "there"}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your program today.
          </p>
        </div>

        {/* Top Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            title="Total Teams"
            value={totalTeams}
          />
          <StatCard
            icon={FileText}
            title="Briefs"
            value={statistics?.briefCount ?? 0}
          />
          <StatCard
            icon={GraduationCap}
            title="Mentors"
            value={mentorCapacity.total}
          />
          <StatCard
            icon={Activity}
            title="Participants"
            value={statistics?.participantCount ?? 0}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selected Cohort Section */}
            {isLoadingCohort ? (
              <div className="flex items-center justify-center rounded-xl bg-card p-16 border border-border">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedCohort ? (
              <ActiveCohortCard
                cohort={selectedCohort}
                statistics={statistics || undefined}
                isLoading={isLoadingStats}
              />
            ) : (
              <NoCohortCard />
            )}

            {/* Charts Row - Line and Bar side by side */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Activity Trend - Line Chart */}
              {isLoadingHourly ? (
                <div className="rounded-xl bg-card p-5 border border-border">
                  <div className="mb-4">
                    <h3 className="font-medium text-foreground">Activity Trend</h3>
                    <p className="text-xs text-muted-foreground">Hourly requests (24h)</p>
                  </div>
                  <div className="h-32 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </div>
              ) : hourlyChartData.length > 0 ? (
                <LineChart
                  title="Activity Trend"
                  description={`Peak: ${hourlyActivity?.peakHour ?? 0}:00 (${hourlyActivity?.peakHourCount ?? 0} requests)`}
                  data={hourlyChartData}
                  dataKey="requests"
                  xAxisKey="hour"
                  color="#3b82f6"
                  height={140}
                  showGrid={false}
                  showDots={false}
                  className="border-border"
                />
              ) : (
                <EmptyChart 
                  title="Activity Trend" 
                  subtitle="Hourly requests (24h)"
                  icon={LineChartIcon}
                />
              )}

              {/* Weekly Activity - Bar Chart */}
              {isLoadingWeekly ? (
                <div className="rounded-xl bg-card p-5 border border-border">
                  <div className="mb-4">
                    <h3 className="font-medium text-foreground">Weekly Activity</h3>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </div>
                  <div className="h-32 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </div>
              ) : weeklyChartData.length > 0 ? (
                <BarChart
                  title="Weekly Activity"
                  description={`Total: ${weeklyActivity?.totalRequests ?? 0} requests, ${weeklyActivity?.totalUniqueUsers ?? 0} users`}
                  data={weeklyChartData}
                  dataKey="requests"
                  xAxisKey="day"
                  color="#22c55e"
                  height={140}
                  showGrid={false}
                  className="border-border"
                />
              ) : (
                <EmptyChart 
                  title="Weekly Activity" 
                  subtitle="Last 7 days"
                  icon={BarChart3}
                />
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            {/* Brief Status */}
            <div className="rounded-xl bg-card p-5 border border-border flex-1">
              <h3 className="font-medium text-foreground mb-3">Brief Status</h3>
              <div>
                <MiniStat label="Draft" value={briefStatusData.draft} />
                <MiniStat label="In Review" value={briefStatusData.inReview} />
                <MiniStat label="Approved" value={briefStatusData.approved} />
                <MiniStat label="Needs Revision" value={briefStatusData.rejected} />
              </div>
            </div>

            {/* Mentor Capacity */}
            <div className="rounded-xl bg-card p-5 border border-border flex-1">
              <h3 className="font-medium text-foreground mb-3">Mentor Capacity</h3>
              <div>
                <MiniStat label="Total Mentors" value={mentorCapacity.total} />
                <MiniStat label="Active" value={mentorCapacity.active} />
                <MiniStat label="Teams Assigned" value={mentorCapacity.assignedTeams} />
                <MiniStat label="Available Slots" value={mentorCapacity.availableSlots} />
              </div>
            </div>

            {/* Team Progress */}
            <div className="rounded-xl bg-card p-5 border border-border flex-1">
              <h3 className="font-medium text-foreground mb-3">Team Progress</h3>
              <div>
                <MiniStat label="Forming" value={teamStatusData.forming} />
                <MiniStat label="Active" value={teamStatusData.active} />
                <MiniStat label="Submitted" value={teamStatusData.submitted} />
                <MiniStat label="Total" value={totalTeams} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}

export default function StaffDashboardPage() {
  return (
    <ProtectedRoute portal="staff">
      <DashboardContent />
    </ProtectedRoute>
  );
}
