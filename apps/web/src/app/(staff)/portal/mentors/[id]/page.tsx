"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  useMentor,
  useMentorTeams,
  useMentorSessions,
  useMentorEarnings,
  useMentorPayments,
  useUpdateMentor,
  useDeleteMentor,
  type MentorStatus,
  type MentorPaymentStatus,
} from "@/lib/api/hooks/use-mentors";
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Calendar,
  Clock,
  Loader2,
  Edit2,
  Trash2,
  ExternalLink,
  Linkedin,
  FileText,
  Crown,
  Star,
  User,
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  Wallet,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusConfig: Record<
  MentorStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  imported: { label: "Imported", variant: "outline" },
  active: { label: "Active", variant: "default" },
  inactive: { label: "Inactive", variant: "destructive" },
};

const paymentStatusConfig: Record<
  MentorPaymentStatus,
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  pending: { label: "Pending", bgClass: "bg-yellow-500/15", textClass: "text-yellow-600", icon: Clock },
  completed: { label: "Completed", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", icon: CheckCircle },
  failed: { label: "Failed", bgClass: "bg-red-500/15", textClass: "text-red-600", icon: XCircle },
  cancelled: { label: "Cancelled", bgClass: "bg-muted", textClass: "text-muted-foreground", icon: AlertCircle },
};

const roleIcons = {
  lead: Crown,
  co_lead: Star,
  member: User,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function MentorDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<MentorStatus>("active");

  const { data: mentor, isLoading, error } = useMentor(id);
  const { data: teams } = useMentorTeams(id);
  const { data: sessions } = useMentorSessions(id);
  const { data: earnings, isLoading: isLoadingEarnings } = useMentorEarnings(id);
  const { data: payments, isLoading: isLoadingPayments } = useMentorPayments(id);

  const updateMutation = useUpdateMentor();
  const deleteMutation = useDeleteMentor();

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !mentor) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Mentor not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/mentors">Back to Mentors</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const config = statusConfig[mentor.status];
  const claimedTeamsCount = teams?.length || 0;

  const handleStatusChange = async () => {
    try {
      await updateMutation.mutateAsync({
        id,
        dto: { status: newStatus },
      });
      toast.success("Status updated successfully");
      setShowStatusDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Mentor deleted successfully");
      router.push("/portal/mentors");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete mentor");
    }
  };

  const totalSessionMinutes = sessions?.reduce((acc, s) => acc + s.durationMinutes, 0) || 0;

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/portal/mentors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-4">
              {mentor.profileImageUrl ? (
                <div className="w-16 h-16 rounded-full overflow-hidden">
                  <img
                    src={mentor.profileImageUrl}
                    alt={`${mentor.firstName} ${mentor.lastName}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <span className="text-xl font-bold text-green-700 dark:text-green-300">
                    {mentor.firstName[0]}
                    {mentor.lastName[0]}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {mentor.firstName} {mentor.lastName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={config.variant}>{config.label}</Badge>
                  {mentor.company && (
                    <span className="text-sm text-muted-foreground">
                      {mentor.title} at {mentor.company}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/portal/mentors/${id}/edit`}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Earnings Overview */}
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Earnings Overview
                </h2>
              </div>
              {isLoadingEarnings ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : earnings ? (
                <div className="p-4">
                  {/* Earnings Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-lg border border-border p-3 bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Session Rate</div>
                      <div className="text-lg font-semibold text-foreground">
                        {formatCurrency(earnings.sessionRate)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Completed Sessions</div>
                      <div className="text-lg font-semibold text-foreground">
                        {earnings.completedSessions}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-emerald-500/10">
                      <div className="text-xs text-emerald-600 mb-1">Total Earned</div>
                      <div className="text-lg font-semibold text-emerald-600">
                        {formatCurrency(earnings.totalEarned)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-amber-500/10">
                      <div className="text-xs text-amber-600 mb-1">Unpaid Balance</div>
                      <div className="text-lg font-semibold text-amber-600">
                        {formatCurrency(earnings.unpaidAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Current Month */}
                  <div className="rounded-lg border border-border p-4 bg-blue-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">This Month</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Earned</div>
                        <div className="text-base font-semibold">{formatCurrency(earnings.currentMonthEarned)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Paid</div>
                        <div className="text-base font-semibold text-emerald-600">{formatCurrency(earnings.currentMonthPaid)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Unpaid</div>
                        <div className="text-base font-semibold text-amber-600">{formatCurrency(earnings.currentMonthUnpaid)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Wallet className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No earnings data available</p>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">Payment History</h2>
                <span className="text-sm text-muted-foreground">
                  {payments?.length || 0} payments
                </span>
              </div>
              {isLoadingPayments ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !payments || payments.length === 0 ? (
                <div className="p-6 text-center">
                  <DollarSign className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet</p>
                </div>
              ) : (
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {payments.map((payment) => {
                    const statusConf = paymentStatusConfig[payment.status];
                    const StatusIcon = statusConf.icon;
                    return (
                      <div key={payment.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {formatCurrency(payment.amount)}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConf.bgClass} ${statusConf.textClass}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusConf.label}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {payment.sessionsCount} sessions
                              {payment.periodStart && payment.periodEnd && (
                                <span className="ml-2">
                                  ({format(new Date(payment.periodStart), "MMM d")} - {format(new Date(payment.periodEnd), "MMM d, yyyy")})
                                </span>
                              )}
                            </div>
                            {payment.paymentReference && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Ref: {payment.paymentReference}
                                {payment.paymentMethod && ` • ${payment.paymentMethod}`}
                              </div>
                            )}
                            {payment.notes && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{payment.notes}</p>
                            )}
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {payment.paidAt ? (
                              <div>Paid {format(new Date(payment.paidAt), "MMM d, yyyy")}</div>
                            ) : (
                              <div>Created {format(new Date(payment.createdAt), "MMM d, yyyy")}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Claimed Teams */}
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">
                  Teams with Active Claims ({claimedTeamsCount})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Teams that have claimed this mentor through the participant portal
                </p>
              </div>
              {teams?.length === 0 ? (
                <div className="p-6 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No teams have claimed this mentor yet
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {teams?.map((team: any) => (
                    <div key={team.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Link
                            href={`/portal/teams/${team.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {team.name}
                          </Link>
                          {team.brief && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {team.brief.title}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {team.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {team.members?.length || 0} members
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Session History */}
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Session History ({sessions?.length || 0})
                </h2>
                <span className="text-sm text-muted-foreground">
                  {Math.round(totalSessionMinutes / 60 * 10) / 10}h total
                </span>
              </div>
              {sessions?.length === 0 ? (
                <div className="p-6 text-center">
                  <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No sessions logged yet
                  </p>
                </div>
              ) : (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {sessions?.map((session) => (
                    <div key={session.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{session.team?.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {session.sessionType}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(session.sessionDate), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {session.durationMinutes} minutes
                      </div>
                      {session.notes && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {session.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Contact Information</h2>
              <dl className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <dd className="text-sm">{mentor.email}</dd>
                </div>
                {mentor.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <dd className="text-sm">{mentor.phone}</dd>
                  </div>
                )}
                {mentor.linkedinUrl && (
                  <div className="flex items-center gap-3">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <dd className="text-sm">
                      <a
                        href={mentor.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        LinkedIn <ExternalLink className="h-3 w-3" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Expertise */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Areas of Expertise</h2>
              {mentor.expertise.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mentor.expertise.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No expertise listed</p>
              )}
            </div>

            {/* Bio */}
            {mentor.bio && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="font-semibold mb-4">Bio</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {mentor.bio}
                </p>
              </div>
            )}

            {/* Vertical Scope */}
            {mentor.verticalScope.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="font-semibold mb-4">Vertical Scope</h2>
                <p className="text-sm text-muted-foreground">
                  This mentor is limited to specific verticals
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {mentor.verticalScope.map((v) => (
                    <Badge key={v} variant="outline" className="text-xs">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Mentor Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as MentorStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="imported">Imported</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Mentor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {mentor.firstName} {mentor.lastName}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function MentorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="staff">
      <MentorDetailContent id={id} />
    </ProtectedRoute>
  );
}
