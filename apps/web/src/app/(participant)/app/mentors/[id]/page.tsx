"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
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
  useBrowseMentors,
  useTeamClaimStatus,
  useClaimMentor,
  useClaimEligibility,
  MENTOR_CAPABILITY_LABELS,
  type MentorBrowseItem,
} from "@/lib/api/hooks/use-mentors";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import {
  ArrowLeft,
  Loader2,
  Building2,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Linkedin,
  Calendar,
  Users,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function MentorDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [showClaimDialog, setShowClaimDialog] = useState(false);

  const { data: participant } = useCurrentParticipant();
  const { data: claimStatus } = useTeamClaimStatus();
  const { data: mentorsData, isLoading } = useBrowseMentors({
    cohortId: participant?.cohortId,
  });
  const { data: eligibility } = useClaimEligibility(id);
  const claimMutation = useClaimMentor();

  // Find the mentor in the browse data
  const mentor = mentorsData?.data.find((m) => m.id === id);

  const handleConfirmClaim = async () => {
    if (!mentor) return;
    try {
      await claimMutation.mutateAsync({ mentorId: mentor.id });
      toast.success(`Successfully claimed ${mentor.firstName} ${mentor.lastName} as your mentor!`);
      setShowClaimDialog(false);
      router.push("/app/mentors");
    } catch (error: any) {
      toast.error(error.message || "Failed to claim mentor");
    }
  };

  if (isLoading) {
    return (
      <ParticipantLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ParticipantLayout>
    );
  }

  if (!mentor) {
    return (
      <ParticipantLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Mentor not found</p>
          <Button asChild className="mt-4">
            <Link href="/app/mentors">Back to Mentors</Link>
          </Button>
        </div>
      </ParticipantLayout>
    );
  }

  const canClaim = claimStatus?.mentorClaimUnlocked && !claimStatus?.hasClaim && mentor.isAvailable;

  return (
    <ParticipantLayout>
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/app/mentors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Mentor Profile</h1>
            <p className="text-sm text-muted-foreground">
              Review this mentor's profile before claiming
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-6 pt-6 pb-6">
            {/* Avatar and basic info */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="shrink-0">
                <div className={cn(
                  "w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden",
                  "bg-gradient-to-br from-primary/20 to-primary/5"
                )}>
                  {mentor.profileImageUrl ? (
                    <img
                      src={mentor.profileImageUrl}
                      alt={`${mentor.firstName} ${mentor.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                      {mentor.firstName[0]}
                      {mentor.lastName[0]}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex-1 pt-2 sm:pt-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {mentor.firstName} {mentor.lastName}
                    </h2>
                    {(mentor.title || mentor.company) && (
                      <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        {mentor.title && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-4 w-4" />
                            {mentor.title}
                          </span>
                        )}
                        {mentor.title && mentor.company && <span>•</span>}
                        {mentor.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {mentor.company}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  
                  {/* Availability badge */}
                  <div className={cn(
                    "shrink-0 px-4 py-2 rounded-full text-sm font-medium",
                    "flex items-center gap-2",
                    mentor.isAvailable
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                      : "bg-muted text-muted-foreground border"
                  )}>
                    {mentor.isAvailable ? (
                      <>
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                        </span>
                        {mentor.availableClaimSlots} slot{mentor.availableClaimSlots !== 1 ? "s" : ""} available
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4" />
                        Fully booked
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* LinkedIn */}
            {mentor.linkedinUrl && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" />
                    View LinkedIn Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {mentor.bio && (
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-3">About</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {mentor.bio}
            </p>
          </div>
        )}

        {/* Capabilities */}
        {mentor.capabilities.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Technical Capabilities
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Areas where this mentor can provide specialized guidance
            </p>
            <div className="flex flex-wrap gap-2">
              {mentor.capabilities.map((cap) => (
                <div
                  key={cap}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/10"
                >
                  <Sparkles className="h-4 w-4" />
                  {MENTOR_CAPABILITY_LABELS[cap]}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expertise */}
        {mentor.expertise.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-3">Areas of Expertise</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Skills and technologies this mentor is proficient in
            </p>
            <div className="flex flex-wrap gap-2">
              {mentor.expertise.map((exp, i) => (
                <Badge key={i} variant="secondary" className="px-3 py-1">
                  {exp}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* What you get section */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            What You Get With This Mentor
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">3 Sessions</p>
                <p className="text-sm text-muted-foreground">Exclusive 1-on-1 mentoring</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Video Calls</p>
                <p className="text-sm text-muted-foreground">Google Meet integration</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Swap Option</p>
                <p className="text-sm text-muted-foreground">One-time mentor swap</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-4 border-t">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {!claimStatus?.mentorClaimUnlocked && (
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Complete your submission to unlock mentor claiming
                </p>
              )}
              {claimStatus?.hasClaim && (
                <p className="text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-600" />
                  You already have a claimed mentor
                </p>
              )}
              {canClaim && !mentor.isAvailable && (
                <p className="text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 inline mr-1" />
                  This mentor is fully booked
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={() => setShowClaimDialog(true)}
              disabled={!canClaim}
              className="px-8"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Claim This Mentor
            </Button>
          </div>
        </div>
      </div>

      {/* Claim Confirmation Dialog */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Mentor</DialogTitle>
            <DialogDescription>
              You're about to claim{" "}
              <strong>
                {mentor.firstName} {mentor.lastName}
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
            <div className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
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
    </ParticipantLayout>
  );
}

export default function MentorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="participant">
      <MentorDetailContent id={id} />
    </ProtectedRoute>
  );
}
