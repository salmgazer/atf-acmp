"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeTeamCountry, GITHUB_USERNAME_PATTERN } from "@acmp/shared";
import { useUpdateParticipant, participantKeys, type Participant, type UpdateParticipantDto } from "@/lib/api/hooks/use-participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fields = [["country", "Country of residence", 255], ["city", "City", 150], ["locationType", "Location type", 150], ["currentAffiliation", "Current affiliation", 150], ["pythonSkill", "Python skill", 255], ["gitSkill", "Git skill", 255], ["aiExperience", "AI experience", 255], ["githubUsername", "GitHub username", 39]] as const;
type Draft = Record<typeof fields[number][0], string>;
const initial = (p: Participant) => Object.fromEntries(fields.map(([field]) => [field, field === "country" ? normalizeTeamCountry(p.country) : p[field] || ""])) as Draft;

export function ParticipantProfileEditor({ participant }: { participant: Participant }) {
  const [open, setOpen] = useState(false), [baseline, setBaseline] = useState(participant), [draft, setDraft] = useState(() => initial(participant)), [error, setError] = useState("");
  const update = useUpdateParticipant();
  const cache = useQueryClient();
  const countries = [...new Set((baseline.cohort?.countries || []).map(normalizeTeamCountry))];
  const changes = Object.fromEntries(fields.filter(([field]) => draft[field].trim() !== initial(baseline)[field]).map(([field]) => [field, draft[field].trim() || null]));
  async function save(event: React.FormEvent) {
    event.preventDefault();setError("");
    if (!draft.country.trim()) { setError("Country is required.");return; }
    if (draft.githubUsername.trim() && !GITHUB_USERNAME_PATTERN.test(draft.githubUsername.trim())) { setError("Enter a valid GitHub username, without @ or a URL.");return; }
    try { await update.mutateAsync({ id: participant.id, data: { ...changes, expectedUpdatedAt: baseline.updatedAt } as UpdateParticipantDto }); setOpen(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save your profile. Your edits have been kept."); }
  }
  const protectedDetails = [["Name", `${baseline.firstName} ${baseline.lastName}`], ["Email", baseline.email], ["LMS email", baseline.lmsEmail], ["Phone", baseline.phoneNumber], ["WhatsApp", baseline.whatsappNumber], ["Gender", baseline.gender], ["Institution", baseline.institution], ["Education level", baseline.educationLevel], ["Field of study", baseline.fieldOfStudy], ["Learning certificate ID", baseline.learningCertificateId]];
  return <>
    <Button variant="outline" onClick={() => { setBaseline(participant);setDraft(initial(participant));setError("");setOpen(true); }}>Edit profile</Button>
    <Dialog open={open} onOpenChange={value => { if (!update.isPending) setOpen(value); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update your location and experience. These details inform brief access and team eligibility.</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-5">
        {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{error.includes("changed") && <Button type="button" variant="outline" onClick={() => { setOpen(false);void cache.invalidateQueries({ queryKey: participantKeys.current() }); }}>Reload latest profile</Button>}</div>}
        <fieldset disabled={update.isPending} className="grid gap-4 sm:grid-cols-2">{fields.map(([field, label, max]) => <div className="space-y-2" key={field}><Label htmlFor={`self-${field}`}>{label}</Label>{field === "country" && countries.length ? <select id={`self-${field}`} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.country} onChange={event => setDraft(current => ({ ...current, country: event.target.value }))}>{!countries.includes(draft.country) && <option value={draft.country}>{draft.country}</option>}{countries.map(country => <option key={country}>{country}</option>)}</select> : <Input id={`self-${field}`} maxLength={max} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />}</div>)}</fieldset>
        <p className="text-sm text-muted-foreground">If you do not have a GitHub account, you can leave the username blank and <a className="underline" href="https://github.com/signup" target="_blank" rel="noopener noreferrer">create an account on GitHub</a>.</p>
        <section className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Details managed by staff</h3><p className="text-sm text-muted-foreground">Contact staff to correct identity, education, contact or certificate details.</p><dl className="grid gap-3 text-sm sm:grid-cols-2">{protectedDetails.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value || "Not provided"}</dd></div>)}</dl></section>
        <DialogFooter><Button type="button" variant="outline" disabled={update.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={update.isPending || !Object.keys(changes).length}>{update.isPending ? "Saving…" : "Save profile"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}
