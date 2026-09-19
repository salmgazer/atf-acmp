"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  useTeam,
  useUpdateTeam,
  useAssignBrief,
  useUnassignBrief,
  useDisqualifyTeam,
  useUpdateMemberRole,
  useTeamSessions,
  type Team,
  type TeamMember,
  type TeamStatus,
  type TeamRole,
  type TeamScheduledSession,
} from "@/lib/api/hooks/use-teams";
import { useApprovedBriefs } from "@/lib/api/hooks/use-briefs";
import {
  ArrowLeft,
  Users,
  Crown,
  Star,
  User,
  FileText,
  Building2,
  MapPin,
  Mail,
  Calendar,
  Loader2,
  Settings,
  XCircle,
  CheckCircle,
  Clock,
  Send,
  Award,
  Pencil,
  Copy,
  GraduationCap,
  UserCircle,
  Briefcase,
  ExternalLink,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusConfig: Record<
  TeamStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle; color: string }
> = {
  forming: { label: "Forming", variant: "outline", icon: Clock, color: "text-yellow-600" },
  active: { label: "Active", variant: "default", icon: CheckCircle, color: "text-green-600" },
  submitted: { label: "Submitted", variant: "secondary", icon: Send, color: "text-blue-600" },
  evaluated: { label: "Evaluated", variant: "default", icon: Award, color: "text-purple-600" },
  disqualified: { label: "Disqualified", variant: "destructive", icon: XCircle, color: "text-red-600" },
};

const roleConfig: Record<TeamRole, { label: string; icon: typeof Crown }> = {
  lead: { label: "Lead", icon: Crown },
  co_lead: { label: "Co-Lead", icon: Star },
  member: { label: "Member", icon: User },
};

function MemberCard({
  member,
  teamId,
  isDisqualified,
}: {
  member: TeamMember;
  teamId: string;
  isDisqualified: boolean;
}) {
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole>(member.role);
  const updateRoleMutation = useUpdateMemberRole();

  const config = roleConfig[member.role];
  const RoleIcon = config.icon;

  const handleUpdateRole = async () => {
    await updateRoleMutation.mutateAsync({
      teamId,
      participantId: member.participantId,
      role: selectedRole,
    });
    setShowRoleDialog(false);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <span className="font-medium">
              {member.participant.firstName[0]}
              {member.participant.lastName[0]}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/portal/participants/${member.participantId}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {member.participant.firstName} {member.participant.lastName}
              </Link>
              <Badge variant="outline" className="text-xs">
                <RoleIcon className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {member.participant.email}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {member.participant.country}
              </span>
            </div>
            {member.participant.institution && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <GraduationCap className="h-3 w-3" />
                {member.participant.institution}
              </div>
            )}
          </div>
        </div>
        {!isDisqualified && (
          <Button variant="ghost" size="sm" onClick={() => setShowRoleDialog(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Update the role for {member.participant.firstName} {member.participant.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="co_lead">Co-Lead</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TeamDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [showAssignBriefDialog, setShowAssignBriefDialog] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);
  const [showDisqualifyDialog, setShowDisqualifyDialog] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState("");
  const [selectedBriefId, setSelectedBriefId] = useState("");

  const { data: team, isLoading, error } = useTeam(id);
  const { data: sessions } = useTeamSessions(id);
  const { data: briefs } = useApprovedBriefs(team?.cohortId || "");

  const assignBriefMutation = useAssignBrief();
  const unassignBriefMutation = useUnassignBrief();
  const disqualifyMutation = useDisqualifyTeam();

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !team) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Team not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/teams">Back to Teams</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const config = statusConfig[team.status];
  const StatusIcon = config.icon;
  const isDisqualified = team.status === "disqualified";

  // For changing briefs, show all briefs with capacity OR the currently assigned brief
  const availableBriefs = briefs?.filter((b) => {
    const assignedCount = b.teamsCount || 0;
    // Include if has capacity OR is the currently assigned brief
    return assignedCount < b.maxTeams || b.id === team.briefId;
  });

  const copyInviteCode = () => {
    navigator.clipboard.writeText(team.inviteCode);
    toast.success("Invite code copied!");
  };

  const handleAssignBrief = async () => {
    if (!selectedBriefId) return;
    await assignBriefMutation.mutateAsync({ teamId: team.id, briefId: selectedBriefId });
    setShowAssignBriefDialog(false);
    setSelectedBriefId("");
  };

  const handleUnassignBrief = async () => {
    await unassignBriefMutation.mutateAsync(team.id);
    setShowUnassignDialog(false);
  };

  const handleDisqualify = async () => {
    if (!disqualifyReason.trim()) return;
    await disqualifyMutation.mutateAsync({
      teamId: team.id,
      reason: disqualifyReason,
      disqualifiedBy: "staff", // TODO: Get actual staff user ID
    });
    setShowDisqualifyDialog(false);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/portal/teams">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
                <Badge variant={config.variant}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {team.members.length} members
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created {format(new Date(team.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>
          {!isDisqualified && (
            <div className="flex gap-2">
              {!team.brief && (
                <Button onClick={() => setShowAssignBriefDialog(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Assign Brief
                </Button>
              )}
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setShowDisqualifyDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Disqualify
              </Button>
            </div>
          )}
        </div>

        {/* Disqualification Alert */}
        {isDisqualified && team.disqualificationReason && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <XCircle className="h-5 w-5" />
              <h2 className="font-semibold">Team Disqualified</h2>
            </div>
            <p className="mt-2 text-red-700 dark:text-red-300">
              {team.disqualificationReason}
            </p>
            {team.disqualifiedAt && (
              <p className="mt-2 text-sm text-red-600">
                Disqualified on {format(new Date(team.disqualifiedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assigned Brief */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Assigned Brief</h2>
              {team.brief ? (
                <div>
                  <Link
                    href={`/portal/briefs/${team.brief.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {team.brief.title}
                  </Link>
                  {team.brief.organization && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      {team.brief.organization.logoUrl ? (
                        <img
                          src={team.brief.organization.logoUrl}
                          alt=""
                          className="w-6 h-6 rounded object-cover"
                        />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <span>{team.brief.organization.name}</span>
                    </div>
                  )}
                  {team.brief.vertical && (
                    <Badge variant="secondary" className="mt-2">
                      {team.brief.vertical.name}
                    </Badge>
                  )}
                  {!isDisqualified && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignBriefDialog(true)}
                      >
                        Change Brief
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setShowUnassignDialog(true)}
                      >
                        Unassign
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No brief assigned</p>
                  {!isDisqualified && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowAssignBriefDialog(true)}
                    >
                      Assign Brief
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Mentor Sessions */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Mentor Sessions</h2>
              {sessions && (sessions.upcoming.length > 0 || sessions.past.length > 0) ? (
                <div className="space-y-6">
                  {/* Upcoming Sessions */}
                  {sessions.upcoming.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Upcoming</h3>
                      <div className="space-y-3">
                        {sessions.upcoming.map((session) => (
                          <div key={session.id} className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {session.mentor.profileImageUrl ? (
                                <img 
                                  src={session.mentor.profileImageUrl} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <UserCircle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <Link
                                  href={`/portal/mentors/${session.mentor.id}`}
                                  className="font-medium hover:text-primary hover:underline truncate"
                                >
                                  {session.mentor.firstName} {session.mentor.lastName}
                                </Link>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  Session {session.sessionNumber}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(session.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{session.question}</p>
                              {session.googleMeetLink && (
                                <a
                                  href={session.googleMeetLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                                >
                                  <Video className="h-3 w-3" />
                                  Join Meeting
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Sessions */}
                  {sessions.past.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Past Sessions</h3>
                      <div className="space-y-3">
                        {sessions.past.slice(0, 5).map((session) => (
                          <div key={session.id} className="flex items-start gap-4 p-3 rounded-lg border">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {session.mentor.profileImageUrl ? (
                                <img 
                                  src={session.mentor.profileImageUrl} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <UserCircle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <Link
                                  href={`/portal/mentors/${session.mentor.id}`}
                                  className="font-medium hover:text-primary hover:underline truncate"
                                >
                                  {session.mentor.firstName} {session.mentor.lastName}
                                </Link>
                                <Badge 
                                  variant={session.status === "completed" ? "default" : "secondary"} 
                                  className="text-xs flex-shrink-0"
                                >
                                  {session.status === "completed" ? "Completed" : session.status === "cancelled" ? "Cancelled" : session.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(session.scheduledAt), "MMM d, yyyy")}</span>
                              </div>
                              {session.notes && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{session.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {sessions.past.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{sessions.past.length - 5} more sessions
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <UserCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No mentor sessions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sessions appear here when the team books time with mentors
                  </p>
                </div>
              )}
            </div>

            {/* Team Members */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">
                Team Members ({team.members.length})
              </h2>
              <div className="space-y-3">
                {team.members
                  .sort((a, b) => {
                    const order = { lead: 0, co_lead: 1, member: 2 };
                    return order[a.role] - order[b.role];
                  })
                  .map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      teamId={team.id}
                      isDisqualified={isDisqualified}
                    />
                  ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Team Details</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Invite Code</dt>
                  <dd className="flex items-center gap-2 mt-1">
                    <code className="font-mono font-bold text-lg">{team.inviteCode}</code>
                    <Button variant="ghost" size="sm" onClick={copyInviteCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </dd>
                </div>
                {team.description && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Description</dt>
                    <dd className="mt-1">{team.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant={config.variant}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {config.label}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="mt-1">
                    {format(new Date(team.createdAt), "MMMM d, yyyy")}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Skills Summary */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Team Skills</h2>
              <div className="flex flex-wrap gap-1">
                {Array.from(
                  new Set(team.members.flatMap((m) => m.participant.skills || []))
                ).map((skill) => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
              {team.members.every((m) => !m.participant.skills?.length) && (
                <p className="text-sm text-muted-foreground">No skills listed</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Brief Dialog */}
      <Dialog open={showAssignBriefDialog} onOpenChange={setShowAssignBriefDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Brief to Team</DialogTitle>
            <DialogDescription>
              Select a brief to assign to "{team.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Brief</Label>
              <Select value={selectedBriefId} onValueChange={setSelectedBriefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brief" />
                </SelectTrigger>
                <SelectContent>
                  {availableBriefs?.map((brief) => (
                    <SelectItem key={brief.id} value={brief.id}>
                      <div>
                        <div>{brief.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {brief.organization?.name} • {brief.teamsCount}/{brief.maxTeams} teams
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignBriefDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignBrief}
              disabled={!selectedBriefId || assignBriefMutation.isPending}
            >
              {assignBriefMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disqualify Dialog */}
      <Dialog open={showDisqualifyDialog} onOpenChange={setShowDisqualifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disqualify Team</DialogTitle>
            <DialogDescription>
              This will disqualify "{team.name}" from the competition. This action cannot be easily undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Disqualification *</Label>
              <Textarea
                placeholder="Explain why this team is being disqualified..."
                value={disqualifyReason}
                onChange={(e) => setDisqualifyReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisqualifyDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisqualify}
              disabled={!disqualifyReason.trim() || disqualifyMutation.isPending}
            >
              {disqualifyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Disqualify Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Brief Dialog */}
      <Dialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign Brief</DialogTitle>
            <DialogDescription>
              Are you sure you want to unassign the brief from "{team.name}"? The team will need a new brief assigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnassignDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnassignBrief}
              disabled={unassignBriefMutation.isPending}
            >
              {unassignBriefMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Unassign Brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="staff">
      <TeamDetailContent id={id} />
    </ProtectedRoute>
  );
}
