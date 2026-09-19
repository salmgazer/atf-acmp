"use client";

import { useState } from "react";
import Link from "next/link";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  useBrowseMentors,
  useTeamClaimStatus,
  useClaimMentor,
  useReleaseClaim,
  useSwapMentor,
  MENTOR_CAPABILITY_LABELS,
  type MentorCapability,
  type MentorBrowseItem,
  type MentorClaim,
} from "@/lib/api/hooks/use-mentors";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import { useMyTeam } from "@/lib/api/hooks/use-teams";
import {
  Search,
  Loader2,
  User,
  Building2,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Calendar,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CAPABILITY_OPTIONS: MentorCapability[] = [
  "retrieval_rag",
  "computer_vision",
  "speech_asr",
  "tabular_ml",
  "agents",
  "fine_tuning",
  "mobile_edge",
  "data_engineering",
];

function MentorCard({
  mentor,
  onClaim,
  isClaiming,
  disabled,
  disabledReason,
}: {
  mentor: MentorBrowseItem;
  onClaim: () => void;
  isClaiming: boolean;
  disabled: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30">
      <Link href={`/app/mentors/${mentor.id}`} className="block p-5">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden",
              "bg-gradient-to-br from-primary/10 to-primary/5"
            )}>
              {mentor.profileImageUrl ? (
                <img
                  src={mentor.profileImageUrl}
                  alt={`${mentor.firstName} ${mentor.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                  {mentor.firstName[0]}
                  {mentor.lastName[0]}
                </span>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                  {mentor.firstName} {mentor.lastName}
                </h3>
                {(mentor.title || mentor.company) && (
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    {mentor.title && <span>{mentor.title}</span>}
                    {mentor.title && mentor.company && (
                      <span className="text-muted-foreground/50">•</span>
                    )}
                    {mentor.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground/70" />
                        {mentor.company}
                      </span>
                    )}
                  </p>
                )}
              </div>
              
              {/* Availability badge */}
              <div className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium",
                "flex items-center gap-1.5 transition-all",
                mentor.isAvailable
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                  : "bg-muted text-muted-foreground"
              )}>
                {mentor.isAvailable ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    {mentor.availableClaimSlots} slot{mentor.availableClaimSlots !== 1 ? "s" : ""}
                  </>
                ) : (
                  "Fully booked"
                )}
              </div>
            </div>

            {/* Bio */}
            {mentor.bio && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                {mentor.bio}
              </p>
            )}

            {/* Capabilities - Premium pills */}
            {mentor.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {mentor.capabilities.slice(0, 3).map((cap) => (
                  <div
                    key={cap}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/10"
                  >
                    <Sparkles className="h-3 w-3" />
                    {MENTOR_CAPABILITY_LABELS[cap]}
                  </div>
                ))}
                {mentor.capabilities.length > 3 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs text-muted-foreground">
                    +{mentor.capabilities.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Expertise tags */}
            {mentor.expertise.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {mentor.expertise.slice(0, 4).map((exp, i) => (
                  <span
                    key={i}
                    className="inline-flex px-2 py-0.5 rounded-md text-xs bg-muted/80 text-muted-foreground"
                  >
                    {exp}
                  </span>
                ))}
                {mentor.expertise.length > 4 && (
                  <span className="inline-flex px-2 py-0.5 rounded-md text-xs bg-muted/60 text-muted-foreground">
                    +{mentor.expertise.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Actions footer - separate from the link */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          {mentor.linkedinUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-primary"
              asChild
            >
              <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                LinkedIn
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-primary"
            asChild
          >
            <Link href={`/app/mentors/${mentor.id}`}>
              View Profile
            </Link>
          </Button>
          {disabled && disabledReason && (
            <span className="text-xs text-muted-foreground">{disabledReason}</span>
          )}
        </div>
        
        <Button
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClaim();
          }}
          disabled={disabled || isClaiming || !mentor.isAvailable}
          className={cn(
            "h-9 px-4 font-medium transition-all",
            mentor.isAvailable && !disabled && "bg-gradient-to-r from-primary to-primary/90 hover:shadow-md hover:shadow-primary/25"
          )}
        >
          {isClaiming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Claim Mentor
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CurrentClaimCard({ claim, onManageSessions, onSwap, onRelease, canSwap }: {
  claim: MentorClaim;
  onManageSessions: () => void;
  onSwap: () => void;
  onRelease: () => void;
  canSwap: boolean;
}) {
  const mentor = claim.mentor;
  const bookedCount = claim.bookedSessionCount || 0;
  const completedCount = claim.sessionCount || 0;
  const sessionsRemaining = 3 - bookedCount;
  const hasBookedSession = bookedCount > 0;
  // Progress based on booked sessions (more meaningful to show)
  const progress = (completedCount / 3) * 100;
  const expiresIn = new Date(claim.expiresAt);
  const isExpiringSoon = expiresIn.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000; // 3 days

  return (
    <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            {mentor?.profileImageUrl ? (
              <img
                src={mentor.profileImageUrl}
                alt=""
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium">
                {mentor?.firstName?.[0]}
                {mentor?.lastName?.[0]}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm opacity-80">Your Mentor</p>
            <h2 className="text-xl font-bold">
              {mentor?.firstName} {mentor?.lastName}
            </h2>
            {(mentor?.title || mentor?.company) && (
              <p className="text-sm opacity-80">
                {mentor?.title}
                {mentor?.title && mentor?.company && " • "}
                {mentor?.company}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "bg-white/20 text-white border-white/30 text-xs px-2 py-0.5 whitespace-nowrap",
            isExpiringSoon && !hasBookedSession && "bg-yellow-500/30 border-yellow-400/50"
          )}
        >
          {!hasBookedSession && isExpiringSoon ? (
            <>
              <AlertCircle className="h-3 w-3 mr-1" />
              Book soon!
            </>
          ) : sessionsRemaining > 0 ? (
            `${sessionsRemaining} left to book`
          ) : (
            "All booked"
          )}
        </Badge>
      </div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Sessions Progress</span>
          <span>{bookedCount} booked · {completedCount} completed</span>
        </div>
        <Progress value={progress} className="h-2 bg-white/20" />
      </div>

      {/* Capabilities */}
      {mentor?.capabilities && mentor.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {mentor.capabilities.map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="text-xs bg-white/10 border-white/30 text-white"
            >
              {MENTOR_CAPABILITY_LABELS[cap]}
            </Badge>
          ))}
        </div>
      )}

      {/* Warning for expiring claims - only show if no session booked yet */}
      {!hasBookedSession && (
        <div className="mt-4 p-3 rounded-lg bg-white/10 text-sm">
          <Clock className="h-4 w-4 inline mr-2" />
          Book your first session by{" "}
          <strong>{format(new Date(claim.expiresAt), "MMM d, yyyy")}</strong> or your claim will
          expire.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        <Button
          variant="secondary"
          className="bg-white text-primary hover:bg-white/90"
          onClick={onManageSessions}
        >
          <Calendar className="h-4 w-4 mr-2" />
          {!hasBookedSession ? "Book First Session" : "Manage Sessions"}
        </Button>
        {canSwap && (
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={onSwap}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Swap Mentor
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={onRelease}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Release
        </Button>
      </div>

      {claim.swapUsed && (
        <p className="text-xs opacity-70 mt-3">
          Note: You've already used your one-time mentor swap.
        </p>
      )}
    </div>
  );
}

function MentorBrowseContent() {
  const [search, setSearch] = useState("");
  const [selectedCapability, setSelectedCapability] = useState<MentorCapability | "all">("all");
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorBrowseItem | null>(null);

  const { data: participant } = useCurrentParticipant();
  const { data: team } = useMyTeam(participant?.id || "");
  const { data: claimStatus, isLoading: claimStatusLoading } = useTeamClaimStatus();

  const { data: mentorsData, isLoading: mentorsLoading } = useBrowseMentors({
    capabilities: selectedCapability !== "all" ? [selectedCapability] : undefined,
    search: search || undefined,
    cohortId: participant?.cohortId,
  });

  const claimMutation = useClaimMentor();
  const releaseMutation = useReleaseClaim();
  const swapMutation = useSwapMentor();

  const handleClaimClick = (mentor: MentorBrowseItem) => {
    setSelectedMentor(mentor);
    setShowClaimDialog(true);
  };

  const handleConfirmClaim = async () => {
    if (!selectedMentor) return;
    try {
      await claimMutation.mutateAsync({ mentorId: selectedMentor.id });
      toast.success(`Successfully claimed ${selectedMentor.firstName} ${selectedMentor.lastName} as your mentor!`);
      setShowClaimDialog(false);
      setSelectedMentor(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to claim mentor");
    }
  };

  const handleRelease = async () => {
    try {
      await releaseMutation.mutateAsync(undefined);
      toast.success("Mentor claim released");
      setShowReleaseDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to release claim");
    }
  };

  const handleSwap = async () => {
    if (!selectedMentor) return;
    try {
      await swapMutation.mutateAsync({ newMentorId: selectedMentor.id });
      toast.success(`Swapped to ${selectedMentor.firstName} ${selectedMentor.lastName}!`);
      setShowSwapDialog(false);
      setSelectedMentor(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to swap mentor");
    }
  };

  const isLoading = claimStatusLoading || mentorsLoading;

  // No team check
  if (!team) {
    return (
      <ParticipantLayout>
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">Join a Team First</h2>
          <p className="text-muted-foreground mt-2">
            You need to be part of a team to claim a mentor.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/team">Go to Team Page</Link>
          </Button>
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold">Find a Mentor</h1>
          <p className="text-sm text-muted-foreground">
            Browse and claim a technical mentor for your team. You get 3 exclusive sessions.
          </p>
        </div>

        {/* Current Claim */}
        {claimStatus?.hasClaim && claimStatus.claim && (
          <CurrentClaimCard
            claim={claimStatus.claim}
            onManageSessions={() => {
              // Navigate to sessions page
              window.location.href = `/app/mentors/sessions`;
            }}
            onSwap={() => setShowSwapDialog(true)}
            onRelease={() => setShowReleaseDialog(true)}
            canSwap={claimStatus.canSwap}
          />
        )}

        {/* Browse Section */}
        {!claimStatus?.hasClaim && (
          <>
            {/* Locked State - Show when mentor claim not unlocked */}
            {claimStatus && !claimStatus.mentorClaimUnlocked && (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Mentor Claim Locked</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  {claimStatus.unlockingStageName
                    ? `Complete and get evaluated on "${claimStatus.unlockingStageName}" to unlock mentor claiming.`
                    : claimStatus.unlockingStageReason || "Mentor claiming is not yet available."}
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/app/submissions">
                    Go to Submissions
                  </Link>
                </Button>
              </div>
            )}

            {/* Show browse when unlocked */}
            {claimStatus?.mentorClaimUnlocked && (
              <>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or company..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={selectedCapability}
                    onValueChange={(v) => setSelectedCapability(v as MentorCapability | "all")}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by capability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Capabilities</SelectItem>
                      {CAPABILITY_OPTIONS.map((cap) => (
                        <SelectItem key={cap} value={cap}>
                          {MENTOR_CAPABILITY_LABELS[cap]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mentors List */}
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : mentorsData && mentorsData.data.length > 0 ? (
                  <div className="space-y-4">
                    {mentorsData.data.map((mentor) => (
                      <MentorCard
                        key={mentor.id}
                        mentor={mentor}
                        onClaim={() => handleClaimClick(mentor)}
                        isClaiming={claimMutation.isPending && selectedMentor?.id === mentor.id}
                        disabled={!!claimStatus?.hasClaim}
                        disabledReason={claimStatus?.hasClaim ? "You already have a mentor" : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-lg border-dashed">
                    <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      {search || selectedCapability !== "all"
                        ? "No mentors found matching your criteria"
                        : "No mentors available at the moment"}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Swap Mode Browse */}
        {claimStatus?.hasClaim && claimStatus.canSwap && showSwapDialog && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Select New Mentor</h2>
              <Button variant="ghost" onClick={() => setShowSwapDialog(false)}>
                Cancel
              </Button>
            </div>
            {/* Reuse the same mentor list but for swapping */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or company..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {mentorsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {mentorsData?.data
                  .filter((m) => m.id !== claimStatus.claim?.mentorId && m.isAvailable)
                  .map((mentor) => (
                    <div
                      key={mentor.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {mentor.firstName[0]}
                            {mentor.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {mentor.firstName} {mentor.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {mentor.company || mentor.title}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedMentor(mentor);
                        }}
                        disabled={swapMutation.isPending}
                      >
                        {swapMutation.isPending && selectedMentor?.id === mentor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Swap to"
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Claim Confirmation Dialog */}
        <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Claim Mentor</DialogTitle>
              <DialogDescription>
                You're about to claim{" "}
                <strong>
                  {selectedMentor?.firstName} {selectedMentor?.lastName}
                </strong>{" "}
                as your team's mentor.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">What you get:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 3 exclusive mentoring sessions</li>
                  <li>• Google Meet video calls with calendar invites</li>
                  <li>• One-time mentor swap option after session 1</li>
                </ul>
              </div>
              <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  You must book your first session within 14 days or your claim will expire.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowClaimDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmClaim} disabled={claimMutation.isPending}>
                {claimMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Confirm Claim
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Release Confirmation Dialog */}
        <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Release Mentor</DialogTitle>
              <DialogDescription>
                Are you sure you want to release your mentor claim? Any scheduled sessions will be
                cancelled and you'll need to claim a new mentor.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>
                Keep Mentor
              </Button>
              <Button
                variant="destructive"
                onClick={handleRelease}
                disabled={releaseMutation.isPending}
              >
                {releaseMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Release Mentor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Swap Confirmation Dialog */}
        <Dialog
          open={showSwapDialog && !!selectedMentor}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMentor(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Swap Mentor</DialogTitle>
              <DialogDescription>
                You're about to swap to{" "}
                <strong>
                  {selectedMentor?.firstName} {selectedMentor?.lastName}
                </strong>
                . This is your one-time swap and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Your remaining sessions ({3 - (claimStatus?.claim?.sessionCount || 0)}) will
                  transfer to your new mentor.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedMentor(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSwap} disabled={swapMutation.isPending}>
                {swapMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                Confirm Swap
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ParticipantLayout>
  );
}

export default function MentorsPage() {
  return (
    <ProtectedRoute portal="participant">
      <MentorBrowseContent />
    </ProtectedRoute>
  );
}
