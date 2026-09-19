"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  useParticipant,
  useParticipantPreferences,
  useUpdateParticipantStatus,
  useDeleteParticipant,
  type ParticipantStatus,
} from "@/lib/api/hooks/use-participants";
import { useMyTeam } from "@/lib/api/hooks/use-teams";
import { useCohort } from "@/lib/api/hooks/use-cohorts";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import { useApprovedBriefs } from "@/lib/api/hooks/use-briefs";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Calendar,
  Loader2,
  Trash2,
  Users,
  FileText,
  CheckCircle,
  Clock,
  UserCheck,
  UserX,
  Crown,
  Star,
  User,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusConfig: Record<
  ParticipantStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }
> = {
  imported: { label: "Imported", variant: "outline", icon: Clock },
  active: { label: "Active", variant: "default", icon: Users },
  onboarding: { label: "Onboarding", variant: "secondary", icon: Clock },
  ready: { label: "Ready", variant: "default", icon: CheckCircle },
  assigned: { label: "Assigned", variant: "default", icon: UserCheck },
  inactive: { label: "Inactive", variant: "destructive", icon: UserX },
};

const roleIcons = {
  lead: Crown,
  co_lead: Star,
  member: User,
};

function ParticipantDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<ParticipantStatus>("active");

  const { data: participant, isLoading, error } = useParticipant(id);
  const { data: team } = useMyTeam(id);
  const { data: preferences } = useParticipantPreferences(id);
  const { data: cohort } = useCohort(participant?.cohortId || "");
  const { data: verticals } = useVerticals(participant?.cohortId || "");
  const { data: briefs } = useApprovedBriefs(participant?.cohortId || "");

  const updateStatusMutation = useUpdateParticipantStatus();
  const deleteMutation = useDeleteParticipant();

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !participant) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Participant not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/participants">Back to Participants</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const config = statusConfig[participant.status];
  const StatusIcon = config.icon;

  // Get vertical names from preferences
  const getVerticalName = (verticalId?: string) => {
    if (!verticalId || !verticals) return null;
    const vertical = verticals.find((v) => v.id === verticalId);
    return vertical?.name;
  };

  // Get brief by ID
  const getBrief = (briefId: string) => {
    if (!briefs) return null;
    return briefs.find((b) => b.id === briefId);
  };

  const handleStatusChange = async () => {
    try {
      await updateStatusMutation.mutateAsync({
        id,
        status: newStatus,
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
      toast.success("Participant deleted successfully");
      router.push("/portal/participants");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete participant");
    }
  };

  // Find the member's role in the team
  const teamMember = team?.members?.find((m) => m.participantId === id);
  const RoleIcon = teamMember ? roleIcons[teamMember.role] : null;

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/portal/participants">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-4">
              {participant.profileImageUrl ? (
                <div className="w-16 h-16 rounded-full overflow-hidden">
                  <img
                    src={participant.profileImageUrl}
                    alt={`${participant.firstName} ${participant.lastName}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {participant.firstName[0]}
                    {participant.lastName[0]}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {participant.firstName} {participant.lastName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={config.variant}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {config.label}
                  </Badge>
                  <code className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    {participant.participantId}
                  </code>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNewStatus(participant.status);
                setShowStatusDialog(true);
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Change Status
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
            {/* Team Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Team</h2>
              {team ? (
                <div>
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/portal/teams/${team.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {team.name}
                    </Link>
                    {teamMember && RoleIcon && (
                      <Badge variant="outline" className="text-xs">
                        <RoleIcon className="mr-1 h-3 w-3" />
                        {teamMember.role === "lead"
                          ? "Lead"
                          : teamMember.role === "co_lead"
                          ? "Co-Lead"
                          : "Member"}
                      </Badge>
                    )}
                  </div>
                  {team.brief && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <Link
                        href={`/portal/briefs/${team.brief.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {team.brief.title}
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {team.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {team.members?.length || 0} members
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Not assigned to a team</p>
                </div>
              )}
            </div>

            {/* Skills & Interests */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Skills & Interests</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Skills</h3>
                  {participant.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {participant.skills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No skills listed</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Interests</h3>
                  {participant.interests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {participant.interests.map((interest) => (
                        <Badge key={interest} variant="outline">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No interests listed</p>
                  )}
                </div>
              </div>
            </div>

            {/* Preferences */}
            {preferences && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Preferences</h2>
                <dl className="space-y-4">
                  {(preferences.verticalId1 || preferences.verticalId2) && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Vertical Preferences</dt>
                      <dd className="mt-1 flex gap-2">
                        {preferences.verticalId1 && (
                          <Badge variant="secondary">
                            1st: {getVerticalName(preferences.verticalId1) || "Unknown"}
                          </Badge>
                        )}
                        {preferences.verticalId2 && (
                          <Badge variant="outline">
                            2nd: {getVerticalName(preferences.verticalId2) || "Unknown"}
                          </Badge>
                        )}
                      </dd>
                    </div>
                  )}
                  {preferences.preferredRole && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Preferred Role</dt>
                      <dd className="mt-1 capitalize">{preferences.preferredRole}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-muted-foreground">Cross-Country Collaboration</dt>
                    <dd className="mt-1">
                      {preferences.crossCountryWilling ? (
                        <Badge variant="default">Willing</Badge>
                      ) : (
                        <Badge variant="outline">Not Preferred</Badge>
                      )}
                    </dd>
                  </div>
                  {preferences.availabilityNotes && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Availability Notes</dt>
                      <dd className="mt-1 text-sm">{preferences.availabilityNotes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Brief Rankings */}
            {preferences?.briefRankings && preferences.briefRankings.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Brief Rankings</h2>
                <div className="space-y-2">
                  {preferences.briefRankings.map((briefId, index) => {
                    const brief = getBrief(briefId);
                    return (
                      <div
                        key={briefId}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          {brief ? (
                            <>
                              <Link
                                href={`/portal/briefs/${brief.id}`}
                                className="font-medium hover:text-primary hover:underline line-clamp-1"
                              >
                                {brief.title}
                              </Link>
                              {brief.organization && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {brief.organization.name}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Brief not found
                            </span>
                          )}
                        </div>
                        {brief?.vertical && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {brief.vertical.name}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Contact Information</h2>
              <dl className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <dd className="text-sm">{participant.email}</dd>
                </div>
                {participant.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <dd className="text-sm">{participant.phoneNumber}</dd>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <dd className="text-sm">{participant.country}</dd>
                </div>
                {participant.institution && (
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <dd className="text-sm">{participant.institution}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Program Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Program Details</h2>
              <dl className="space-y-3">
                {cohort && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Cohort</dt>
                    <dd className="mt-1">
                      <Link
                        href={`/portal/cohorts/${cohort.id}`}
                        className="text-sm hover:text-primary hover:underline"
                      >
                        {cohort.name}
                      </Link>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Onboarding</dt>
                  <dd className="mt-1">
                    {participant.onboardingComplete ? (
                      <Badge variant="default">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Imported</dt>
                  <dd className="mt-1 text-sm flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {format(new Date(participant.createdAt), "MMM d, yyyy")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Last Updated</dt>
                  <dd className="mt-1 text-sm flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {format(new Date(participant.updatedAt), "MMM d, yyyy")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Participant Status</DialogTitle>
            <DialogDescription>
              Update the status for {participant.firstName} {participant.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ParticipantStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imported">Imported</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending && (
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
            <DialogTitle>Delete Participant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {participant.firstName} {participant.lastName}? This
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

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="staff">
      <ParticipantDetailContent id={id} />
    </ProtectedRoute>
  );
}
