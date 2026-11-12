"use client";

import { useState } from "react";
import { GITHUB_USERNAME_PATTERN, PARTICIPANT_LEARNING_FIELDS, PARTICIPANT_IMPORT_LABELS, normalizeTeamCountry, SUPPORTED_COUNTRIES } from "@acmp/shared";
import { useParticipant, useUpdateStaffParticipantProfile, type Participant, type StaffParticipantProfileChanges } from "@/lib/api/hooks/use-participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

const groups = [
  { title: "Personal details", fields: ["firstName", "lastName", "country", "institution", "phoneNumber", "whatsappNumber", "city", "locationType", "gender"] },
  { title: "LMS and education", fields: ["lmsEmail", "educationLevel", "currentAffiliation", "fieldOfStudy", "pythonSkill", "gitSkill", "aiExperience", "githubUsername", "skills", "interests"] },
  { title: "Learning records", fields: [...PARTICIPANT_LEARNING_FIELDS] },
] as const;
type Field = typeof groups[number]["fields"][number];
const fields = groups.flatMap(group => [...group.fields]);
const labels: Record<Field, string> = { ...PARTICIPANT_IMPORT_LABELS, country: "Country", lmsEmail: "LMS email", skills: "Skills", interests: "Interests" };
const booleanFields: Field[] = ["learningCertificateIssued", "learningFinishedAllLessons", "learningHalfwayReached"];
function values(participant: Participant): Record<Field, string> {
  return Object.fromEntries(fields.map(field => {
    const value = field === "country" ? normalizeTeamCountry(participant.country) : participant[field];
    return [field, booleanFields.includes(field) ? value === true ? "yes" : value === false ? "no" : "unknown" : Array.isArray(value) ? value.join(", ") : value ?? ""];
  })) as Record<Field, string>;
}
function parse(field: Field, value: string) {
  if (booleanFields.includes(field)) return value === "yes" ? true : value === "no" ? false : null;
  if (field === "skills" || field === "interests") return [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))];
  return value.trim() || (field === "institution" || field === "phoneNumber" ? "" : null);
}
function display(value: unknown) { return value === null || value === undefined || value === "" ? "Not provided" : Array.isArray(value) ? value.join(", ") || "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : String(value); }

export function StaffParticipantProfileEditor({ participant, countries }: { participant: Participant; countries: string[] }) {
  const [open, setOpen] = useState(false), [review, setReview] = useState(false), [baseline, setBaseline] = useState(participant), [draft, setDraft] = useState(values(participant)), [error, setError] = useState("");
  const update = useUpdateStaffParticipantProfile(), current = useParticipant(participant.id);
  const changed = fields.filter(field => JSON.stringify(parse(field, draft[field])) !== JSON.stringify(parse(field, values(baseline)[field])));
  const changes = Object.fromEntries(changed.map(field => [field, parse(field, draft[field])])) as StaffParticipantProfileChanges;
  if ("learningCertificateIssued" in changes && changes.learningCertificateIssued !== true) { changes.learningCertificateId = null; changes.learningCertificateDate = null; }
  const reviewedFields = [...new Set([...changed, ...Object.keys(changes) as Field[]])].filter(field => JSON.stringify(changes[field]) !== JSON.stringify(baseline[field] ?? null));
  const countryOptions = [...new Set([...(countries.length ? countries : SUPPORTED_COUNTRIES), baseline.country].map(normalizeTeamCountry))].filter(Boolean);
  const reset = (profile: Participant) => { setBaseline(profile); setDraft(values(profile)); setReview(false); setError(""); update.reset(); };
  const learningChanged = changed.some(field => (PARTICIPANT_LEARNING_FIELDS as readonly string[]).includes(field));
  const toReview = (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (draft.githubUsername.trim() && !GITHUB_USERNAME_PATTERN.test(draft.githubUsername.trim()) && changed.includes("githubUsername")) { setError("Enter a GitHub username, not a profile URL."); return; }
    if (learningChanged && draft.learningCertificateIssued === "yes" && !draft.learningCertificateId.trim()) { setError("A learning certificate marked Yes requires a certificate ID."); return; }
    setReview(true);
  };
  const save = async () => {
    setError("");
    try { await update.mutateAsync({ id: participant.id, changes, expectedUpdatedAt: baseline.updatedAt, allowLearningCorrections: learningChanged }); setOpen(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the profile. Try again."); }
  };
  return <>
    <Button variant="outline" onClick={() => { reset(participant); setOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit profile</Button>
    <Dialog open={open} onOpenChange={value => { if (!update.isPending) setOpen(value); }}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={event => { if (update.isPending) event.preventDefault(); }} onPointerDownOutside={event => { if (update.isPending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{review ? "Review participant changes" : "Edit participant profile"}</DialogTitle><DialogDescription>{baseline.firstName} {baseline.lastName} · {baseline.participantId}. Changes are recorded in the audit log.</DialogDescription></DialogHeader>
        {error && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</div>}
        {review ? <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Country, study, skill and learning corrections can affect brief access and team eligibility. These checks use the saved profile.</p>
          {learningChanged && <p className="rounded-lg border p-3 text-sm">Review the learning records carefully. Withdrawing a learning certificate clears its ID and date.</p>}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Field</th><th className="p-2 text-left">Current value</th><th className="p-2 text-left">New value</th></tr></thead><tbody>{reviewedFields.map(field => <tr key={field} className="border-t"><th className="p-2 text-left font-medium">{labels[field]}</th><td className="p-2 break-words">{display(baseline[field])}</td><td className="p-2 break-words">{display(changes[field])}</td></tr>)}</tbody></table></div>
          <DialogFooter><Button variant="outline" disabled={update.isPending} onClick={() => setReview(false)}>Back to editing</Button><Button disabled={update.isPending || !reviewedFields.length} onClick={save}>{update.isPending ? "Saving…" : "Confirm changes"}</Button></DialogFooter>
        </div> : <form onSubmit={toReview} className="space-y-6">
          {groups.map(group => <section key={group.title} className="space-y-3"><h3 className="font-semibold">{group.title}</h3><div className="grid gap-4 sm:grid-cols-2">{group.fields.map(field => <div key={field} className="space-y-1"><Label htmlFor={`staff-profile-${field}`}>{labels[field]}</Label>{field === "country" || booleanFields.includes(field) ? <select id={`staff-profile-${field}`} className="h-11 w-full rounded-lg border bg-background px-3 text-sm" value={draft[field]} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))}>{field === "country" ? countryOptions.map(country => <option key={country} value={country}>{country}</option>) : <><option value="unknown">Not provided</option><option value="yes">Yes</option><option value="no">No</option></>}</select> : <Input id={`staff-profile-${field}`} type={field === "lmsEmail" ? "email" : field === "learningCertificateDate" ? "date" : "text"} required={field === "firstName" || field === "lastName"} maxLength={field === "whatsappNumber" ? 50 : field === "skills" || field === "interests" ? 5000 : 255} value={draft[field]} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))} />}{(field === "skills" || field === "interests") && <p className="text-xs text-muted-foreground">Separate values with commas.</p>}</div>)}</div></section>)}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={!changed.length}>Review changes</Button></DialogFooter>
        </form>}
        {error && <Button variant="outline" disabled={update.isPending || current.isFetching} onClick={async () => { const result = await current.refetch(); if (result.data) reset(result.data); }}>Reload latest profile</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
