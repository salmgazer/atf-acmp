"use client";

import { useState, type ReactNode } from "react";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS, matchingOptionLabel, type ParticipantPeerProfile } from "@acmp/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useParticipantMatchingProfile } from "@/lib/api/hooks/use-teams";
import { Github, Loader2, MapPin } from "lucide-react";

function Details({ items }: { items: [string, string | null | undefined][] }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
    {items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || "Not provided"}</dd></div>)}
  </dl>;
}
function Tags({ title, values }: { title: string; values: string[] }) {
  return <section className="space-y-2"><h3 className="font-medium">{title}</h3>{values.length ? <div className="flex flex-wrap gap-2">{values.map(value => <Badge key={value} variant="secondary">{value}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Not provided</p>}</section>;
}
function Profile({ profile }: { profile: ParticipantPeerProfile }) {
  const { matching } = profile;
  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Avatar className="h-14 w-14"><AvatarImage src={profile.profileImageUrl || undefined} alt="" /><AvatarFallback>{profile.firstName[0]}{profile.lastName[0]}</AvatarFallback></Avatar>
      <div className="min-w-0"><h3 className="text-lg font-semibold break-words">{profile.firstName} {profile.lastName}</h3><p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{profile.country}</p></div>
    </div>
    <section className="space-y-3"><h3 className="font-medium">Team matching</h3><Details items={[
      ["Preferred role", matchingOptionLabel(MATCHING_ROLE_OPTIONS, matching.preferredRole)],
      ["Build and deploy ability", matchingOptionLabel(BUILD_DEPLOY_OPTIONS, matching.buildDeployAbility)],
      ["Qualified builder", profile.qualifiedBuilder ? "Yes" : "No"],
      ["First-choice sector", matchingOptionLabel(MATCHING_SECTOR_OPTIONS, matching.firstChoiceSector)],
      ["Backup sector", matchingOptionLabel(MATCHING_SECTOR_OPTIONS, matching.backupSector)],
      ["Open to a cross-country team", matching.crossCountryWilling ? "Yes" : "No"],
      ["Team status preference", matchingOptionLabel(MATCHING_TEAM_STATUS_OPTIONS, matching.teamStatus)],
    ]} /><p className="text-xs text-muted-foreground">A qualified builder has Intermediate, Advanced or Expert Python skills and confident build/deploy ability, or staff-verified CodeLabs completion.</p></section>
    <Tags title="Skills" values={profile.skills} />
    <Tags title="Interests" values={profile.interests} />
    <section className="space-y-3"><h3 className="font-medium">Background</h3><Details items={[
      ["Institution", profile.institution], ["Education level", profile.educationLevel],
      ["Field of study", profile.fieldOfStudy], ["Current affiliation", profile.currentAffiliation],
      ["Non-computing study requirement", profile.nonComputingStudy ? "Yes" : "No"],
    ]} /></section>
    <section className="space-y-3"><h3 className="font-medium">Technical experience</h3><Details items={[
      ["Python skill", profile.pythonSkill], ["Git skill", profile.gitSkill], ["AI experience", profile.aiExperience],
    ]} />{profile.githubUsername && <a href={`https://github.com/${encodeURIComponent(profile.githubUsername)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary underline"><Github className="h-4 w-4" />{profile.githubUsername} on GitHub</a>}</section>
  </div>;
}
function ProfileContent({ participantId }: { participantId: string }) {
  const { data, isPending, isFetching, isError, error, refetch } = useParticipantMatchingProfile(participantId);
  if (isPending || isFetching) return <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading matching profile…</div>;
  if (isError || !data) return <div className="space-y-3 py-4"><p role="alert" className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "This matching profile is not available. The participant may not have enabled profile sharing."}</p><Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button></div>;
  return <Profile profile={data} />;
}

export function ParticipantProfileButton({ participantId, name, children, compact = false }: { participantId: string; name: string; children?: ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant={compact ? "secondary" : "outline"} size="sm" className={compact ? "h-auto rounded-full px-2.5 py-1 text-xs" : "shrink-0"} aria-label={`View profile for ${name}`}>{children || "View profile"}</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Participant profile</DialogTitle><DialogDescription>Shared profile details to help you choose teammates.</DialogDescription></DialogHeader>
      {open && <ProfileContent participantId={participantId} />}
    </DialogContent>
  </Dialog>;
}
