"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS } from "@acmp/shared";
import { useUpdateParticipantMatchingProfile, participantKeys, type ParticipantMatchingChanges, type ParticipantPreference } from "@/lib/api/hooks/use-participants";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import { useApprovedBriefs } from "@/lib/api/hooks/use-briefs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";
const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const fields = [
  ["buildDeployAbility", "Can you build and deploy an application?", BUILD_DEPLOY_OPTIONS],
  ["preferredRole", "Preferred team role", MATCHING_ROLE_OPTIONS],
  ["firstChoiceSector", "First-choice sector", MATCHING_SECTOR_OPTIONS],
  ["backupSector", "Backup sector", MATCHING_SECTOR_OPTIONS],
  ["teamStatus", "Team status", MATCHING_TEAM_STATUS_OPTIONS],
  ["crossCountryWilling", "Open to a cross-country team?", yesNo],
  ["matchingProfileConsent", "Show your matching profile to other participants?", yesNo],
] as const;
type Draft = Record<typeof fields[number][0] | "verticalId1" | "verticalId2" | "availabilityNotes", string> & { briefRankings: string[] };
function initial(preference: ParticipantPreference): Draft {
  return { buildDeployAbility: preference.buildDeployAbility || "", preferredRole: preference.preferredRole || "", firstChoiceSector: preference.firstChoiceSector || "", backupSector: preference.backupSector || "", teamStatus: preference.teamStatus || "", crossCountryWilling: preference.crossCountryWilling ? "yes" : "no", matchingProfileConsent: preference.matchingProfileConsent == null ? "" : preference.matchingProfileConsent ? "yes" : "no", verticalId1: preference.verticalId1 || "", verticalId2: preference.verticalId2 || "", availabilityNotes: preference.availabilityNotes || "", briefRankings: [...(preference.briefRankings || []), "", "", "", "", ""].slice(0, 5) };
}
function normalized(draft: Draft): ParticipantMatchingChanges {
  return { ...Object.fromEntries(fields.map(([field]) => [field, ["crossCountryWilling", "matchingProfileConsent"].includes(field) ? draft[field] === "yes" : draft[field]])), verticalId1: draft.verticalId1 || null, verticalId2: draft.verticalId2 || null, availabilityNotes: draft.availabilityNotes.trim() || null, briefRankings: draft.briefRankings.filter(Boolean) };
}

export function ParticipantMatchingEditor({ participantId, cohortId, preference }: { participantId: string; cohortId: string; preference: ParticipantPreference }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<Draft>(() => initial(preference)), [baseline, setBaseline] = useState(preference), [error, setError] = useState("");
  const update = useUpdateParticipantMatchingProfile(), cache = useQueryClient();
  const { data: verticals = [] } = useVerticals(open ? cohortId : undefined);
  const { data: briefs = [] } = useApprovedBriefs(open ? cohortId : "");
  const values = normalized(draft), original = normalized(initial(baseline));
  const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key as keyof ParticipantMatchingChanges]))) as ParticipantMatchingChanges;
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (fields.some(([field]) => !draft[field])) { setError("Answer each matching question before saving."); return; }
    if (draft.firstChoiceSector === draft.backupSector) { setError("Choose a different backup sector."); return; }
    if (draft.verticalId1 && draft.verticalId1 === draft.verticalId2) { setError("Choose different programme verticals."); return; }
    if (!baseline.updatedAt) { setError("Reload the latest answers before editing."); return; }
    try { await update.mutateAsync({ id: participantId, changes, expectedUpdatedAt: baseline.updatedAt }); setOpen(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save your matching profile. Your edits have been kept."); }
  }
  return <>
    <Button variant="outline" onClick={() => { setBaseline(preference); setDraft(initial(preference)); setError(""); setOpen(true); }}>Edit matching profile</Button>
    <Dialog open={open} onOpenChange={value => { if (!update.isPending) setOpen(value); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit matching profile</DialogTitle><DialogDescription>Your answers inform team matching and eligibility. Team status describes your preference; use the Team page to create, join or leave a team.</DialogDescription></DialogHeader>
        <form className="space-y-5" onSubmit={save}>
          {error && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}<Button className="mt-2" type="button" variant="outline" onClick={() => { setOpen(false); void cache.invalidateQueries({ queryKey: participantKeys.preferences(participantId) }); }}>Reload latest answers</Button></div>}
          <fieldset disabled={update.isPending} className="grid gap-4 sm:grid-cols-2">
            {fields.map(([field, label, options]) => <div key={field} className="space-y-2"><Label htmlFor={`matching-${field}`}>{label}</Label><select id={`matching-${field}`} className={selectClass} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))}><option value="" disabled>Select an answer</option>{options.map(option => <option key={option.value} value={option.value} disabled={field === "backupSector" && option.value === draft.firstChoiceSector}>{option.label}</option>)}</select></div>)}
            {["verticalId1", "verticalId2"].map((field, index) => <div key={field} className="space-y-2"><Label htmlFor={`matching-${field}`}>Programme vertical {index + 1}</Label><select id={`matching-${field}`} className={selectClass} value={draft[field as "verticalId1" | "verticalId2"]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))}><option value="">Not selected</option>{draft[field as "verticalId1" | "verticalId2"] && !verticals.some(vertical => vertical.id === draft[field as "verticalId1" | "verticalId2"]) && <option value={draft[field as "verticalId1" | "verticalId2"]}>{(index === 0 ? baseline.vertical1?.name : baseline.vertical2?.name) || "Previously selected vertical"}</option>}{verticals.filter(vertical => vertical.isActive || vertical.id === draft[field as "verticalId1" | "verticalId2"]).map(vertical => <option key={vertical.id} value={vertical.id}>{vertical.name}{!vertical.isActive ? " (inactive)" : ""}</option>)}</select></div>)}
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="matching-availability">Availability notes</Label><Textarea id="matching-availability" maxLength={2000} value={draft.availabilityNotes} onChange={event => setDraft(current => ({ ...current, availabilityNotes: event.target.value }))} /></div>
          </fieldset>
          <fieldset disabled={update.isPending} className="space-y-3"><legend className="font-medium">Brief rankings</legend><p className="text-sm text-muted-foreground">Rank up to five approved briefs available to your team. Your preferences help staff with matching.</p>{draft.briefRankings.map((id, index) => <div key={index} className="space-y-2"><Label htmlFor={`matching-brief-${index}`}>Brief choice {index + 1}</Label><select id={`matching-brief-${index}`} className={selectClass} value={id} onChange={event => setDraft(current => ({ ...current, briefRankings: current.briefRankings.map((value, position) => position === index ? event.target.value : value) }))}><option value="">Not selected</option>{id && !briefs.some(brief => brief.id === id) && <option value={id}>Previously ranked brief (currently unavailable)</option>}{briefs.map(brief => <option key={brief.id} value={brief.id} disabled={draft.briefRankings.includes(brief.id) && brief.id !== id}>{brief.title}</option>)}</select></div>)}</fieldset>
          <DialogFooter><Button type="button" variant="outline" disabled={update.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={update.isPending || !Object.keys(changes).length}>{update.isPending ? "Saving…" : "Save matching profile"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
