"use client";
import { useState } from "react";
import Link from "next/link";
import type { ParticipantPreference } from "@/lib/api/hooks/use-participants";
import { useUpdateCrossCountryPreference, useUpdateMatchingConsent } from "@/lib/api/hooks/use-participants";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS, matchingOptionLabel } from "@acmp/shared";
import { Button } from "@/components/ui/button";
import { ParticipantMatchingEditor } from "./participant-matching-editor";
import { Label } from "@/components/ui/label";

function CrossCountryPreference({ participantId, willing }: { participantId: string; willing: boolean }) {
  const update = useUpdateCrossCountryPreference();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const saved = willing ? "yes" : "no";
  const value = draft ?? saved;

  async function save() {
    setError("");
    try {
      await update.mutateAsync({ id: participantId, crossCountryWilling: value === "yes" });
      setDraft(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update your preference. Please try again.");
    }
  }

  return <div className="space-y-3 border-t pt-4">
    <Label htmlFor="cross-country-preference">Open to a cross-country team?</Label>
    <p id="cross-country-description" className="text-sm text-muted-foreground">Choose whether you are willing to team up with participants living in other countries. Every member of a cross-country team must choose Yes for the team to register and start challenge work.</p>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select id="cross-country-preference" aria-describedby="cross-country-description" value={value} disabled={update.isPending} onChange={event => { setDraft(event.target.value); setError(""); }} className="h-11 rounded-xl border border-input bg-background px-4 text-sm sm:w-40">
        <option value="yes">Yes</option><option value="no">No</option>
      </select>
      <Button variant="outline" disabled={update.isPending || value === saved} onClick={save}>{update.isPending ? "Saving…" : "Save cross-country preference"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

export function MatchingProfile({ preference, participantId, cohortId, editable = false }: { cohortId?: string; preference?: ParticipantPreference | null; participantId: string; editable?: boolean }) {
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
    ["Programme vertical 1", preference?.vertical1?.name || "Not selected"],
    ["Programme vertical 2", preference?.vertical2?.name || "Not selected"],
    ["Availability notes", preference?.availabilityNotes || "Not provided"],
  ];
  return <section className="space-y-4 rounded-xl border bg-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Team matching profile</h2>{editable && cohortId && preference?.matchingProfileCompletedAt && <ParticipantMatchingEditor participantId={participantId} cohortId={cohortId} preference={preference} />}</div>{editable && !preference?.matchingProfileCompletedAt && <div className="space-y-3"><p className="text-sm text-muted-foreground">Complete the new matching questions to record your preferred role, sectors and team needs.</p><Button asChild variant="outline"><Link href="/participant/onboarding">Complete my matching profile</Link></Button></div>}<dl className="grid gap-4 text-sm sm:grid-cols-2">{rows.map(([title, value]) => <div key={title}><dt className="text-muted-foreground">{title}</dt><dd className="font-medium">{value}</dd></div>)}</dl>{editable && preference?.matchingProfileCompletedAt && <CrossCountryPreference key={participantId} participantId={participantId} willing={preference.crossCountryWilling} />}{editable && <div className="space-y-3 border-t pt-4"><p className="text-sm text-muted-foreground">Your visibility choice controls whether other participants can find you in teammate searches. Your contact details and learning certificate are excluded from those results.</p><Button variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: participantId, consent: preference?.matchingProfileConsent !== true })}>{update.isPending ? "Saving…" : preference?.matchingProfileConsent ? "Hide my matching profile" : "Show my matching profile"}</Button>{preference?.matchingProfileConsent == null && <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: participantId, consent: false })}>Keep my matching profile hidden</Button>}</div>}</section>;
}
