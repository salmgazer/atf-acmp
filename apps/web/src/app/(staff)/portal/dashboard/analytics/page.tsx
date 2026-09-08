"use client";

import { useState, useMemo } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  KPICard,
  ProgressList,
  DataTableCard,
  BarChart,
  LineChart,
  DonutChart,
  AreaChart,
} from "@/components/dashboard";
import {
  useDashboardOverview,
  useDashboardTeams,
  useDashboardSubmissions,
  useDashboardEvaluations,
  type DashboardQueryParams,
} from "@/lib/api/hooks/use-dashboard";
import { useActiveCohort } from "@/lib/api/hooks/use-cohorts";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import {
  Users,
  UserCheck,
  FileCheck,
  Award,
  AlertTriangle,
  Building2,
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CHART_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

function AnalyticsDashboardContent() {
  const { data: activeCohort, isLoading: isLoadingCohort } = useActiveCohort();
  const { data: verticalsData } = useVerticals(activeCohort?.id || "");

  const [filters, setFilters] = useState<Partial<DashboardQueryParams>>({});

  const queryParams: DashboardQueryParams = useMemo(
    () => ({
      cohortId: activeCohort?.id || "",
      ...filters,
    }),
    [activeCohort?.id, filters]
  );

  const { data: overview, isLoading: isLoadingOverview } = useDashboardOverview(queryParams);
  const { data: teams, isLoading: isLoadingTeams } = useDashboardTeams(queryParams);
  const { data: submissions, isLoading: isLoadingSubmissions } = useDashboardSubmissions(queryParams);
  const { data: evaluations, isLoading: isLoadingEvaluations } = useDashboardEvaluations(queryParams);

  const isLoading = isLoadingCohort || isLoadingOverview || isLoadingTeams || isLoadingSubmissions || isLoadingEvaluations;

  // Transform data for charts
  const statusChartData = useMemo(() => {
    if (!teams?.byStatus) return [];
    return [
      { name: "Forming", value: teams.byStatus.forming, color: CHART_COLORS[6] },
      { name: "Active", value: teams.byStatus.active, color: CHART_COLORS[0] },
      { name: "Submitted", value: teams.byStatus.submitted, color: CHART_COLORS[1] },
      { name: "Evaluated", value: teams.byStatus.evaluated, color: CHART_COLORS[4] },
      { name: "Disqualified", value: teams.byStatus.disqualified, color: CHART_COLORS[3] },
    ].filter((d) => d.value > 0);
  }, [teams?.byStatus]);

  const verticalChartData = useMemo(() => {
    if (!teams?.byVertical) return [];
    return teams.byVertical.map((v, i) => ({
      name: v.verticalName,
      value: v.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [teams?.byVertical]);

  const registrationTrendData = useMemo(() => {
    if (!teams?.registrationTrend) return [];
    return teams.registrationTrend.map((t) => ({
      date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: t.count,
    }));
  }, [teams?.registrationTrend]);

  const submissionTrendData = useMemo(() => {
    if (!submissions?.submissionTrend) return [];
    return submissions.submissionTrend.map((t) => ({
      date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: t.count,
    }));
  }, [submissions?.submissionTrend]);

  const stageProgressData = useMemo(() => {
    if (!submissions?.byStage) return [];
    return submissions.byStage.map((s) => ({
      label: `Stage ${s.stageNumber}: ${s.stageName}`,
      value: s.submissionRate,
      variant: s.submissionRate >= 80 ? "success" : s.submissionRate >= 50 ? "warning" : "danger",
    })) as Array<{ label: string; value: number; variant: "success" | "warning" | "danger" }>;
  }, [submissions?.byStage]);

  const scoreDistributionData = useMemo(() => {
    if (!evaluations?.scoreDistribution) return [];
    return evaluations.scoreDistribution.map((s) => ({
      range: s.range,
      count: s.count,
    }));
  }, [evaluations?.scoreDistribution]);

  if (!activeCohort && !isLoadingCohort) {
    return (
      <StaffLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Active Cohort</h2>
          <p className="mt-2 text-muted-foreground">
            Please activate a cohort to view analytics.
          </p>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              {activeCohort?.name || "Loading..."} - Performance insights and metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={filters.verticalId || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, verticalId: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Verticals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verticals</SelectItem>
                {verticalsData?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({})}>
              Reset Filters
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Teams"
            value={overview?.totalTeams ?? 0}
            subtitle={`${overview?.averageTeamSize ?? 0} avg team size`}
            icon={Users}
            variant="default"
            loading={isLoadingOverview}
          />
          <KPICard
            title="Submission Rate"
            value={`${overview?.submissionRate ?? 0}%`}
            subtitle="Teams that submitted"
            icon={FileCheck}
            variant={
              (overview?.submissionRate ?? 0) >= 80
                ? "success"
                : (overview?.submissionRate ?? 0) >= 50
                ? "warning"
                : "danger"
            }
            loading={isLoadingOverview}
          />
          <KPICard
            title="Evaluated"
            value={evaluations?.totalEvaluated ?? 0}
            subtitle={`${evaluations?.pendingEvaluation ?? 0} pending`}
            icon={Award}
            variant="info"
            loading={isLoadingEvaluations}
          />
          <KPICard
            title="Dropout Rate"
            value={`${overview?.dropoutRate ?? 0}%`}
            subtitle={`${overview?.disqualifiedTeams ?? 0} disqualified`}
            icon={AlertTriangle}
            variant={(overview?.dropoutRate ?? 0) > 10 ? "danger" : "default"}
            loading={isLoadingOverview}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard
            title="Participants"
            value={overview?.totalParticipants ?? 0}
            icon={UserCheck}
            loading={isLoadingOverview}
          />
          <KPICard
            title="Organizations"
            value={overview?.totalOrganizations ?? 0}
            icon={Building2}
            loading={isLoadingOverview}
          />
          <KPICard
            title="Avg AI Score"
            value={evaluations?.averageAIScore ?? 0}
            subtitle="Out of 100"
            loading={isLoadingEvaluations}
          />
          <KPICard
            title="Avg Final Score"
            value={evaluations?.averageFinalScore ?? 0}
            subtitle="Out of 100"
            icon={TrendingUp}
            variant={
              (evaluations?.averageFinalScore ?? 0) >= 70
                ? "success"
                : (evaluations?.averageFinalScore ?? 0) >= 50
                ? "warning"
                : "default"
            }
            loading={isLoadingEvaluations}
          />
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <AreaChart
                title="Registration Trend"
                description="New team registrations over time"
                data={registrationTrendData}
                dataKey="count"
                xAxisKey="date"
                color="#3b82f6"
                height={250}
              />
              <AreaChart
                title="Submission Trend"
                description="Submissions over time"
                data={submissionTrendData}
                dataKey="count"
                xAxisKey="date"
                color="#22c55e"
                height={250}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <DonutChart
                title="Teams by Status"
                description="Current status distribution"
                data={statusChartData}
                height={280}
              />
              <DonutChart
                title="Teams by Vertical"
                description="Distribution across verticals"
                data={verticalChartData}
                height={280}
              />
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <BarChart
                title="Team Size Distribution"
                description="Number of teams by member count"
                data={teams?.teamSizeDistribution?.map((t) => ({
                  size: `${t.size} members`,
                  count: t.count,
                })) ?? []}
                dataKey="count"
                xAxisKey="size"
                color="#3b82f6"
                height={280}
              />
              <DataTableCard
                title="Teams by Country"
                description="Geographic distribution of teams"
                columns={[
                  { key: "country", header: "Country" },
                  { key: "count", header: "Teams", align: "right" },
                  {
                    key: "percentage",
                    header: "Share",
                    align: "right",
                    render: (v) => `${v}%`,
                  },
                ]}
                data={teams?.byCountry?.slice(0, 10) ?? []}
                loading={isLoadingTeams}
              />
            </div>
            <LineChart
              title="Daily Registrations"
              description="Team registration pattern"
              data={registrationTrendData}
              dataKey="count"
              xAxisKey="date"
              color="#8b5cf6"
              height={280}
            />
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ProgressList
                title="Stage Completion Rates"
                items={stageProgressData}
              />
              <DataTableCard
                title="Submission Statistics by Stage"
                columns={[
                  { key: "stageName", header: "Stage" },
                  { key: "submitted", header: "Submitted", align: "right" },
                  { key: "late", header: "Late", align: "right" },
                  { key: "pending", header: "Pending", align: "right" },
                  {
                    key: "averageScore",
                    header: "Avg Score",
                    align: "right",
                    render: (v) => (v !== null ? `${v}` : "-"),
                  },
                ]}
                data={submissions?.byStage ?? []}
                loading={isLoadingSubmissions}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <KPICard
                title="Overall Submission Rate"
                value={`${submissions?.overallSubmissionRate ?? 0}%`}
                subtitle="Across all stages"
                variant={
                  (submissions?.overallSubmissionRate ?? 0) >= 80
                    ? "success"
                    : (submissions?.overallSubmissionRate ?? 0) >= 50
                    ? "warning"
                    : "danger"
                }
                loading={isLoadingSubmissions}
              />
              <KPICard
                title="Late Submission Rate"
                value={`${submissions?.lateSubmissionRate ?? 0}%`}
                subtitle="Of total submissions"
                variant={
                  (submissions?.lateSubmissionRate ?? 0) > 20 ? "warning" : "default"
                }
                loading={isLoadingSubmissions}
              />
              <KPICard
                title="Total Stages"
                value={submissions?.byStage?.length ?? 0}
                subtitle="In this cohort"
                loading={isLoadingSubmissions}
              />
            </div>
          </TabsContent>

          <TabsContent value="evaluations" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <BarChart
                title="Score Distribution"
                description="Teams by final score range"
                data={scoreDistributionData}
                dataKey="count"
                xAxisKey="range"
                color="#8b5cf6"
                height={280}
              />
              <DataTableCard
                title="Evaluation by Stage"
                columns={[
                  { key: "stageName", header: "Stage" },
                  { key: "evaluated", header: "Evaluated", align: "right" },
                  {
                    key: "averageScore",
                    header: "Avg Score",
                    align: "right",
                    render: (v) => `${v}`,
                  },
                ]}
                data={evaluations?.byStage ?? []}
                loading={isLoadingEvaluations}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              <KPICard
                title="Total Evaluated"
                value={evaluations?.totalEvaluated ?? 0}
                variant="success"
                loading={isLoadingEvaluations}
              />
              <KPICard
                title="Pending Evaluation"
                value={evaluations?.pendingEvaluation ?? 0}
                variant={
                  (evaluations?.pendingEvaluation ?? 0) > 0 ? "warning" : "default"
                }
                loading={isLoadingEvaluations}
              />
              <KPICard
                title="Avg AI Score"
                value={evaluations?.averageAIScore ?? 0}
                subtitle="40% weight"
                loading={isLoadingEvaluations}
              />
              <KPICard
                title="Avg Human Score"
                value={evaluations?.averageHumanScore ?? 0}
                subtitle="60% weight"
                loading={isLoadingEvaluations}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </StaffLayout>
  );
}

export default function AnalyticsDashboardPage() {
  return (
    <ProtectedRoute portal="staff">
      <AnalyticsDashboardContent />
    </ProtectedRoute>
  );
}
