"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  useUpdateMentor,
  useAssignMentor,
  useUnassignMentor,
  useDeleteMentor,
  type MentorStatus,
} from "@/lib/api/hooks/use-mentors";
import { useTeams } from "@/lib/api/hooks/use-teams";
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  Loader2,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  ExternalLink,
  Linkedin,
  CheckCircle,
  XCircle,
  FileText,
  Crown,
  Star,
  User,
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

const roleIcons = {
  lead: Crown,
  co_lead: Star,
  member: User,
};

function MentorDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [unassignReason, setUnassignReason] = useState("");
  const [unassignTeamId, setUnassignTeamId] = useState("");
  const [newStatus, setNewStatus] = useState<MentorStatus>("active");

  const { data: mentor, isLoading, error } = useMentor(id);
  const { data: teams } = useMentorTeams(id);
  const { data: sessions } = useMentorSessions(id);

  // Get teams without mentors for assignment
  const { data: availableTeamsData } = useTeams({
    cohortId: mentor?.cohortId,
    status: "active",
    limit: 100,
  });

  const assignMutation = useAssignMentor();
  const unassignMutation = useUnassignMentor();
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
  const assignedCount = mentor.assignments?.filter((a) => a.isActive)?.length || 0;
  const capacityPercent = (assignedCount / mentor.maxTeams) * 100;
  const hasCapacity = assignedCount < mentor.maxTeams;

  // Filter teams that don't have a mentor assigned
  const availableTeams = availableTeamsData?.data?.filter(
    (t: any) => !t.mentorId && mentor.cohortId === t.cohortId
  ) || [];

  const handleAssign = async () => {
    if (!selectedTeamId) return;
    try {
      await assignMutation.mutateAsync({
        mentorId: id,
        teamId: selectedTeamId,
        notes: assignNotes,
      });
      toast.success("Team assigned successfully");
      setShowAssignDialog(false);
      setSelectedTeamId("");
      setAssignNotes("");
    } catch (error: any) {
      toast.error(error.message || "Failed to assign team");
    }
  };

  const handleUnassign = async () => {
    if (!unassignTeamId) return;
    try {
      await unassignMutation.mutateAsync({
        mentorId: id,
        teamId: unassignTeamId,
        reason: unassignReason,
      });
      toast.success("Team unassigned successfully");
      setShowUnassignDialog(false);
      setUnassignTeamId("");
      setUnassignReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to unassign team");
    }
  };

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
                <div className="relative w-16 h-16 rounded-full overflow-hidden">
                  <Image
                    src={mentor.profileImageUrl}
                    alt={`${mentor.firstName} ${mentor.lastName}`}
                    fill
                    className="object-cover"
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
            {/* Capacity Card */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Team Capacity</h2>
                {hasCapacity && (
                  <Button onClick={() => setShowAssignDialog(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign Team
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {assignedCount} of {mentor.maxTeams} teams assigned
                  </span>
                  <span className="text-sm font-medium">
                    {Math.round(capacityPercent)}%
                  </span>
                </div>
                <Progress value={capacityPercent} className="h-3" />
                {!hasCapacity && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Mentor is at full capacity
                  </p>
                )}
              </div>
            </div>

            {/* Assigned Teams */}
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">
                  Assigned Teams ({teams?.length || 0})
                </h2>
              </div>
              {teams?.length === 0 ? (
                <div className="p-6 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No teams assigned yet
                  </p>
                  {hasCapacity && (
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      Assign First Team
                    </Button>
                  )}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setUnassignTeamId(team.id);
                            setShowUnassignDialog(true);
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
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
                {mentor.calendlyLink && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <dd className="text-sm">
                      <a
                        href={mentor.calendlyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Calendly <ExternalLink className="h-3 w-3" />
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

      {/* Assign Team Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Team to Mentor</DialogTitle>
            <DialogDescription>
              Select a team to assign to {mentor.firstName} {mentor.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No teams available for assignment
                    </div>
                  ) : (
                    availableTeams.map((team: any) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Any notes about this assignment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedTeamId || assignMutation.isPending}
            >
              {assignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Team Dialog */}
      <Dialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this team assignment?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={unassignReason}
                onChange={(e) => setUnassignReason(e.target.value)}
                placeholder="Reason for unassigning..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnassignDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnassign}
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Unassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
