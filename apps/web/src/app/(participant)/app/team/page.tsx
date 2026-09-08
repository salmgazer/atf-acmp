"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
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
  useMyTeam,
  useCreateTeam,
  useUpdateTeam,
  useLeaveTeam,
  useSendInvitation,
  useTeamInvitations,
  useCancelInvitation,
  useSearchAvailableParticipants,
  useMyInvitations,
  useAcceptInvitation,
  useDeclineInvitation,
  useJoinTeamByCode,
  useOpenTeams,
  type Team,
  type TeamMember,
  type TeamInvitation,
  type TeamRole,
} from "@/lib/api/hooks/use-teams";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import {
  Users,
  Plus,
  Crown,
  Star,
  User,
  Search,
  Send,
  X,
  Check,
  Clock,
  Loader2,
  Settings,
  LogOut,
  Copy,
  FileText,
  Building2,
  Mail,
  MapPin,
  Hash,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const roleConfig: Record<TeamRole, { label: string; icon: typeof Crown; color: string }> = {
  lead: { label: "Lead", icon: Crown, color: "text-yellow-600" },
  co_lead: { label: "Co-Lead", icon: Star, color: "text-blue-600" },
  member: { label: "Member", icon: User, color: "text-muted-foreground" },
};

function MemberCard({ member, isCurrentUser }: { member: TeamMember; isCurrentUser: boolean }) {
  const config = roleConfig[member.role];
  const RoleIcon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        isCurrentUser && "bg-primary/5 border-primary/20"
      )}
    >
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <span className="font-medium text-sm">
          {member.participant.firstName[0]}
          {member.participant.lastName[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {member.participant.firstName} {member.participant.lastName}
          </span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs">
              You
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RoleIcon className={cn("h-3 w-3", config.color)} />
          <span>{config.label}</span>
          <span>•</span>
          <MapPin className="h-3 w-3" />
          <span>{member.participant.country}</span>
        </div>
      </div>
    </div>
  );
}

function TeamDashboard({
  team,
  participantId,
}: {
  team: Team;
  participantId: string;
}) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const currentMember = team.members.find((m) => m.participantId === participantId);
  const isLeadOrCoLead = currentMember?.role === "lead" || currentMember?.role === "co_lead";
  const isLead = currentMember?.role === "lead";

  const leaveMutation = useLeaveTeam();

  const copyInviteCode = () => {
    navigator.clipboard.writeText(team.inviteCode);
    toast.success("Invite code copied!");
  };

  const handleLeave = async () => {
    await leaveMutation.mutateAsync({ teamId: team.id, participantId });
    setShowLeaveDialog(false);
  };

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{team.name}</h1>
            <p className="text-sm opacity-90 mt-1">
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isLeadOrCoLead && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettingsDialog(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
        {team.description && (
          <p className="text-sm opacity-80 mt-3">{team.description}</p>
        )}
      </div>

      {/* Assigned Brief */}
      {team.brief ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <FileText className="h-4 w-4" />
            <span>Assigned Brief</span>
          </div>
          <h3 className="font-semibold">{team.brief.title}</h3>
          {team.brief.organization && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{team.brief.organization.name}</span>
            </div>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/app/briefs/${team.brief.id}`}>
              View Brief
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mt-2">
            No brief assigned yet
          </p>
          <p className="text-xs text-muted-foreground">
            Briefs will be assigned after team formation
          </p>
        </div>
      )}

      {/* Team Members */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Team Members</h2>
          {isLeadOrCoLead && (
            <Button size="sm" onClick={() => setShowInviteDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Invite
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {team.members
            .sort((a, b) => {
              const order = { lead: 0, co_lead: 1, member: 2 };
              return order[a.role] - order[b.role];
            })
            .map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                isCurrentUser={member.participantId === participantId}
              />
            ))}
        </div>
      </div>

      {/* Invite Code */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Invite Code</p>
            <p className="text-2xl font-mono font-bold tracking-wider">
              {team.inviteCode}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyInviteCode}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Share this code with others to join your team
        </p>
      </div>

      {/* Pending Invitations */}
      {isLeadOrCoLead && <PendingInvitations teamId={team.id} participantId={participantId} />}

      {/* Leave Team */}
      {!isLead && (
        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={() => setShowLeaveDialog(true)}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave Team
        </Button>
      )}

      {/* Invite Dialog */}
      <InviteDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        teamId={team.id}
        cohortId={team.cohortId}
        invitedBy={participantId}
      />

      {/* Settings Dialog */}
      <TeamSettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        team={team}
      />

      {/* Leave Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave "{team.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeave}
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Leave Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingInvitations({
  teamId,
  participantId,
}: {
  teamId: string;
  participantId: string;
}) {
  const { data: invitations } = useTeamInvitations(teamId);
  const cancelMutation = useCancelInvitation();

  const pendingInvitations = invitations?.filter((i) => i.status === "pending") || [];

  if (pendingInvitations.length === 0) return null;

  return (
    <div>
      <h2 className="font-semibold mb-3">Pending Invitations</h2>
      <div className="space-y-2">
        {pendingInvitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between p-3 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">
                  {invitation.participant?.firstName} {invitation.participant?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sent {formatDistanceToNow(new Date(invitation.invitedAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                cancelMutation.mutate({
                  invitationId: invitation.id,
                  cancelledBy: participantId,
                })
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteDialog({
  open,
  onClose,
  teamId,
  cohortId,
  invitedBy,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  cohortId: string;
  invitedBy: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");

  const { data: participants, isLoading } = useSearchAvailableParticipants(
    cohortId,
    searchQuery
  );
  const sendInvitation = useSendInvitation();

  const handleInvite = async (participantId: string) => {
    await sendInvitation.mutateAsync({
      teamId,
      data: { participantId, invitedBy, message: message || undefined },
    });
    setSearchQuery("");
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Participants</DialogTitle>
          <DialogDescription>
            Search for participants to invite to your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Add a personal message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>

          {searchQuery.length >= 2 && (
            <div className="max-h-[200px] overflow-auto space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : participants && participants.length > 0 ? (
                participants.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.country}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInvite(p.id)}
                      disabled={sendInvitation.isPending}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Invite
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No participants found
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamSettingsDialog({
  open,
  onClose,
  team,
}: {
  open: boolean;
  onClose: () => void;
  team: Team;
}) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");

  const updateMutation = useUpdateTeam();

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      id: team.id,
      data: { name, description: description || undefined },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Team Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Team Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending || !name}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoTeamView({ participantId, cohortId }: { participantId: string; cohortId: string }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const createMutation = useCreateTeam();
  const joinMutation = useJoinTeamByCode();
  const { data: invitations } = useMyInvitations(participantId, "pending");
  const { data: openTeams, isLoading: teamsLoading } = useOpenTeams(cohortId, teamSearch);

  const handleCreate = async () => {
    await createMutation.mutateAsync({
      name: teamName,
      description: teamDescription || undefined,
      cohortId,
      creatorId: participantId,
    });
    setShowCreateDialog(false);
    setTeamName("");
    setTeamDescription("");
  };

  const handleJoinByCode = async () => {
    if (inviteCode.length !== 8) {
      toast.error("Invite code must be 8 characters");
      return;
    }
    await joinMutation.mutateAsync({ inviteCode: inviteCode.toUpperCase(), participantId });
    setInviteCode("");
  };

  const handleJoinTeam = async (team: Team) => {
    await joinMutation.mutateAsync({ inviteCode: team.inviteCode, participantId });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Create or join a team to participate
        </p>
      </div>

      {/* Pending Invitations */}
      {invitations && invitations.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">
            Pending Invitations ({invitations.length})
          </h2>
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </div>
        </div>
      )}

      {/* Join with Code */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Have an Invite Code?</h3>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter 8-character code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={8}
            className="font-mono uppercase tracking-wider"
          />
          <Button
            onClick={handleJoinByCode}
            disabled={joinMutation.isPending || inviteCode.length !== 8}
          >
            {joinMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Join"
            )}
          </Button>
        </div>
      </div>

      {/* Create Team Card */}
      <div className="rounded-lg border bg-card p-6 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Start Your Own Team</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a team and invite other participants to join
        </p>
        <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Find Teams */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Find a Team</h2>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            className="pl-9"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
          />
        </div>

        {teamsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : openTeams && openTeams.length > 0 ? (
          <div className="space-y-3">
            {openTeams.map((team) => (
              <OpenTeamCard
                key={team.id}
                team={team}
                onJoin={() => handleJoinTeam(team)}
                isJoining={joinMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <UserPlus className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {teamSearch ? "No teams found matching your search" : "No open teams available"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your own team or wait for an invitation
            </p>
          </div>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>
              Give your team a name and start inviting members
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name *</Label>
              <Input
                placeholder="e.g. Innovation Squad"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What's your team about?"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !teamName.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpenTeamCard({
  team,
  onJoin,
  isJoining,
}: {
  team: Team;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const spotsLeft = 5 - team.members.length; // Assuming max 5 for now

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{team.name}</h3>
          {team.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {team.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{team.members.length} members</span>
            </div>
            <span className="text-green-600">{spotsLeft} spots left</span>
          </div>
          {/* Show member names */}
          <div className="flex flex-wrap gap-1 mt-2">
            {team.members.slice(0, 3).map((member) => (
              <Badge key={member.id} variant="secondary" className="text-xs">
                {member.participant.firstName}
              </Badge>
            ))}
            {team.members.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{team.members.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" onClick={onJoin} disabled={isJoining}>
          {isJoining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Join
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function InvitationCard({ invitation }: { invitation: TeamInvitation }) {
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{invitation.team?.name}</h3>
          <p className="text-sm text-muted-foreground">
            Invited by {invitation.inviter?.firstName} {invitation.inviter?.lastName}
          </p>
          {invitation.message && (
            <p className="text-sm mt-2 italic">"{invitation.message}"</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(invitation.invitedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={() => acceptMutation.mutate(invitation.id)}
          disabled={acceptMutation.isPending || declineMutation.isPending}
        >
          {acceptMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              Accept
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => declineMutation.mutate(invitation.id)}
          disabled={acceptMutation.isPending || declineMutation.isPending}
        >
          {declineMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              Decline
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function TeamPageContent() {
  const { data: participant, isLoading: participantLoading } = useCurrentParticipant();
  const { data: team, isLoading: teamLoading } = useMyTeam(participant?.id || "");

  const isLoading = participantLoading || teamLoading;

  if (isLoading) {
    return (
      <ParticipantLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParticipantLayout>
    );
  }

  if (!participant) {
    return (
      <ParticipantLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load participant data</p>
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      {team ? (
        <TeamDashboard team={team} participantId={participant.id} />
      ) : (
        <NoTeamView participantId={participant.id} cohortId={participant.cohortId} />
      )}
    </ParticipantLayout>
  );
}

export default function TeamPage() {
  return (
    <ProtectedRoute portal="participant">
      <TeamPageContent />
    </ProtectedRoute>
  );
}
