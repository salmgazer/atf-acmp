"use client";

import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useBriefs, type Brief, type BriefStatus } from "@/lib/api/hooks/use-briefs";
import { useCurrentOrganization } from "@/lib/api/hooks/use-organizations";
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  Loader2,
  Building2,
  MoreVertical,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const statusConfig: Record<BriefStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  submitted: { label: "Submitted", variant: "default", icon: Clock },
  in_review: { label: "In Review", variant: "default", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: AlertCircle },
  revision_requested: { label: "Revision Needed", variant: "outline", icon: AlertCircle },
};

// Stat card matching staff dashboard design
function StatCard({ 
  icon: Icon, 
  title, 
  value, 
}: { 
  icon: React.ElementType;
  title: string; 
  value: string | number;
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
      </div>
    </div>
  );
}

function BriefCard({ brief }: { brief: Brief }) {
  const config = statusConfig[brief.status];
  const StatusIcon = config.icon;

  return (
    <div className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{brief.title}</h3>
            <Badge variant={config.variant} className="shrink-0">
              <StatusIcon className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {brief.description}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {brief.vertical && (
              <span className="bg-muted px-2 py-0.5 rounded">{brief.vertical.name}</span>
            )}
            <span>
              {brief.teamsCount}/{brief.maxTeams} teams
            </span>
            <span>
              Updated {formatDistanceToNow(new Date(brief.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/org/briefs/${brief.id}`}>
            View
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
      {brief.status === "revision_requested" && brief.reviewFeedback && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-200">Revision Requested:</p>
          <p className="mt-1 text-yellow-700 dark:text-yellow-300">{brief.reviewFeedback}</p>
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { data: currentOrg, isLoading: isOrgLoading } = useCurrentOrganization();
  // Get cohort directly from the organization response
  const cohort = currentOrg?.cohort;
  
  const { data: briefsData, isLoading } = useBriefs({
    organizationId: currentOrg?.id,
    limit: 10,
  });

  const briefs = briefsData?.data || [];
  const stats = {
    total: briefs.length,
    approved: briefs.filter((b) => b.status === "approved").length,
    pending: briefs.filter((b) => ["submitted", "in_review"].includes(b.status)).length,
    draft: briefs.filter((b) => b.status === "draft").length,
    needsRevision: briefs.filter((b) => b.status === "revision_requested").length,
    totalTeams: briefs.reduce((sum, b) => sum + b.teamsCount, 0),
  };

  // Check if cohort query is still pending when org has cohortId
  const hasCohort = !!cohort;
  const nextDeadline = cohort?.deadlines?.stage1End
    ? new Date(cohort.deadlines.stage1End)
    : null;

  // Show loading state while org data is being fetched
  if (isOrgLoading) {
    return (
      <OrganizationLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OrganizationLayout>
    );
  }

  return (
    <OrganizationLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your challenge briefs and track team progress.
            </p>
          </div>
          {hasCohort && (
            <Button asChild>
              <Link href="/org/briefs/new">
                <Plus className="mr-2 h-4 w-4" />
                New Brief
              </Link>
            </Button>
          )}
        </div>

        {/* Active Cohort Banner */}
        {cohort && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Active Challenge</p>
                <p className="text-lg font-semibold">{cohort.name}</p>
              </div>
              {nextDeadline && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Next Deadline</p>
                  <p className="font-medium">{format(nextDeadline, "MMM d, yyyy")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={FileText}
            title="My Briefs"
            value={stats.total}
          />
          <StatCard
            icon={CheckCircle}
            title="Approved"
            value={stats.approved}
          />
          <StatCard
            icon={Clock}
            title="Pending Review"
            value={stats.pending}
          />
          <StatCard
            icon={Users}
            title="Teams Working"
            value={stats.totalTeams}
          />
        </div>

        {/* Briefs needing attention */}
        {stats.needsRevision > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="h-5 w-5" />
              <h2 className="font-semibold">Action Required</h2>
            </div>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              You have {stats.needsRevision} brief{stats.needsRevision > 1 ? "s" : ""} that need{stats.needsRevision === 1 ? "s" : ""} revision.
            </p>
          </div>
        )}

        {/* Briefs List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Briefs</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/org/briefs">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading || isOrgLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : briefs.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No briefs yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first innovation brief to get started.
              </p>
              {hasCohort && (
                <Button asChild className="mt-4">
                  <Link href="/org/briefs/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Brief
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {briefs.slice(0, 5).map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          )}
        </div>
      </div>
    </OrganizationLayout>
  );
}

export default function OrganizationDashboardPage() {
  return (
    <ProtectedRoute portal="organization">
      <DashboardContent />
    </ProtectedRoute>
  );
}
