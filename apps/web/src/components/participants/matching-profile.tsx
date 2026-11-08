"use client";
import Link from "next/link";
import type { ParticipantPreference } from "@/lib/api/hooks/use-participants";
import { useUpdateMatchingConsent } from "@/lib/api/hooks/use-participants";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS, matchingOptionLabel } from "@acmp/shared";
import { Button } from "@/components/ui/button";

export function MatchingProfile({ preference, participantId, editable = false }: { preference?: ParticipantPreference | null; participantId: string; editable?: boolean }) {
  const update = useUpdateMatchingConsent();
  if (!preference?.matchingProfileCompletedAt && !editable) return null;
  const rows = [
    ["Build and deploy", matchingOptionLabel(BUILD_DEPLOY_OPTIONS, preference?.buildDeployAbility)],
    ["Preferred team role", matchingOptionLabel(MATCHING_ROLE_OPTIONS, preference?.preferredRole)],
    ["First-choice sector", matchingOptionLabel(MATCHING_SECTOR_OPTIONS, preference?.firstChoiceSector)],
    ["Backup sector", matchingOptionLabel(MATCHING_SECTOR_OPTIONS, preference?.backupSector)],
    ["Team status", matchingOptionLabel(MATCHING_TEAM_STATUS_OPTIONS, preference?.teamStatus)],
    ["Cross-country team", preference?.matchingProfileCompletedAt ? preference.crossCountryWilling ? "Yes" : "No" : "Not provided"],
    ["Matching profile visible", preference?.matchingProfileConsent == null ? "Not answered" : preference.matchingProfileConsent ? "Yes" : "No"],
  ];
  return <section className="space-y-4 rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">Team matching profile</h2>{editable && !preference?.matchingProfileCompletedAt && <div className="space-y-3"><p className="text-sm text-muted-foreground">Complete the new matching questions to record your preferred role, sectors and team needs.</p><Button asChild variant="outline"><Link href="/participant/onboarding">Complete my matching profile</Link></Button></div>}<dl className="grid gap-4 text-sm sm:grid-cols-2">{rows.map(([title, value]) => <div key={title}><dt className="text-muted-foreground">{title}</dt><dd className="font-medium">{value}</dd></div>)}</dl>{editable && <div className="space-y-3 border-t pt-4"><p className="text-sm text-muted-foreground">Your visibility choice controls whether other participants can find you in teammate searches. Your contact details and learning certificate are excluded from those results.</p><Button variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: participantId, consent: preference?.matchingProfileConsent !== true })}>{update.isPending ? "Saving…" : preference?.matchingProfileConsent ? "Hide my matching profile" : "Show my matching profile"}</Button>{preference?.matchingProfileConsent == null && <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: participantId, consent: false })}>Keep my matching profile hidden</Button>}</div>}</section>;
}
