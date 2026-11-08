"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PARTICIPANT_IMPORT_LABELS, PARTICIPANT_PROGRAMME_IMPORT_FIELDS, PARTICIPANT_LEARNING_FIELDS, PARTICIPANT_PROFILE_IMPORT_FIELDS, PARTICIPANT_LMS_CSV_HEADERS, type ParticipantImportField } from "@acmp/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { usePreviewParticipantImport, useApplyParticipantImport, useParticipantImportBatch, type ParticipantImportInput, type ParticipantImportPreview, type ParticipantImportRow } from "@/lib/api/hooks/use-participant-import";

const show = (value: string | boolean | null | undefined) => value == null ? "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : value;
const label = (field: string) => PARTICIPANT_IMPORT_LABELS[field as ParticipantImportField] || ({ lmsEmail: "LMS email", country: "Country", group: "Group" } as Record<string, string>)[field] || field;
const selectClass = "h-10 rounded-md border border-border bg-background px-3 text-sm";
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function ParticipantImportPanel() {
  const cache = useQueryClient(), userId = useAuthStore(state => state.user?.id), storageKey = userId ? `acmp-participant-import:${userId}` : null;
  const { data } = useCohorts({ limit: 100 });
  const [cohortId, setCohortId] = useState(""), [group, setGroup] = useState("");
  const [csv, setCsv] = useState(""), [sourceName, setSourceName] = useState("participants.csv");
  const [mode, setMode] = useState<ParticipantImportInput["mode"]>("create_and_update");
  const [updateFields, setUpdateFields] = useState<ParticipantImportField[]>([...PARTICIPANT_LEARNING_FIELDS]);
  const [allowLearningCorrections, setAllowLearningCorrections] = useState(false), [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [preview, setPreview] = useState<ParticipantImportPreview | null>(null), [dirty, setDirty] = useState(true);
  const [confirming, setConfirming] = useState(false), [review, setReview] = useState<ParticipantImportRow | null>(null);
  const [filter, setFilter] = useState("all"), [page, setPage] = useState(1), [batchId, setBatchId] = useState<string | null>(null);
  const previewMutation = usePreviewParticipantImport(), applyMutation = useApplyParticipantImport();
  const { data: batch, isError: batchError, error: batchFailure, refetch } = useParticipantImportBatch(batchId);
  const running = !!batchId && (!batch || ["queued", "active"].includes(batch.state) || batch.result.invitationState === "pending");
  const busy = previewMutation.isPending || applyMutation.isPending || running;
  const groups = data?.data.find(cohort => cohort.id === cohortId)?.groups || [];
  const input: ParticipantImportInput = { cohortId, csv, sourceName, mode, updateFields, allowLearningCorrections, sendWelcomeEmail, group: mode !== "update_only" && group ? group : undefined };
  const invalidate = () => { setDirty(true); setConfirming(false); setPage(1); };
  useEffect(() => {
    if (!storageKey) return;
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); if (saved?.id && saved.createdAt > Date.now() - 86400000) setBatchId(saved.id); } catch { /* Optional progress cache. */ }
  }, [storageKey]);
  useEffect(() => {
    if ((batchFailure as Error & { statusCode?: number })?.statusCode === 404) { setBatchId(null); if (storageKey) try { sessionStorage.removeItem(storageKey); } catch { /* Optional cache. */ } }
  }, [batchFailure, storageKey]);
  useEffect(() => { if (batch?.state === "completed") { cache.invalidateQueries({ queryKey: ["participants"] }); cache.invalidateQueries({ queryKey: ["teams"] }); } }, [batch?.id, batch?.state, cache]);
  const refresh = async () => {
    if (new Blob([csv]).size > 2000000) { toast.error("Use a CSV smaller than 2 MB"); return; }
    try { setPreview(await previewMutation.mutateAsync(input)); setDirty(false); setFilter("all"); setPage(1); } catch { setDirty(true); }
  };
  const load = async (file?: File) => {
    if (!file) return;
    if (file.size > 2000000) { toast.error("Use a CSV smaller than 2 MB"); return; }
    try { setCsv(await file.text()); setSourceName(file.name); setPreview(null); invalidate(); } catch { toast.error("Could not read the CSV"); }
  };
  const apply = async () => {
    if (!preview?.ready || dirty) return;
    try {
      const queued = await applyMutation.mutateAsync({ ...input, previewHash: preview.previewHash });
      setBatchId(queued.id); setConfirming(false); setDirty(true);
      if (storageKey) try { sessionStorage.setItem(storageKey, JSON.stringify({ id: queued.id, createdAt: Date.now() })); } catch { /* Optional cache. */ }
    } catch { setConfirming(false); setDirty(true); }
  };
  const template = () => download(PARTICIPANT_LMS_CSV_HEADERS.join(",") + "\n" + ["sample-participant", "Jane", "Example", "jane@example.test", "+233200000001", "", "Ghana", "Accra", "Urban (city centre)", "Female", "Example University", "Bachelor's", "Recent graduate", "Education", "Intermediate", "Basic", "Self-taught", "", "No", "", "No", "Yes", ""].join(",") + "\n", "participants_template.csv", "text/csv");
  const rows = preview?.records.filter(row => filter === "all" || row.outcome === filter) || [], pages = Math.max(1, Math.ceil(rows.length / 25));
  const writes = (preview?.counts.new || 0) + (preview?.counts.updated || 0);
  const checkbox = (field: ParticipantImportField) => <label key={field} className="flex items-center gap-2 text-sm"><Checkbox checked={updateFields.includes(field)} disabled={busy} onCheckedChange={checked => { setUpdateFields(current => checked === true ? [...new Set([...current, field])] : current.filter(item => item !== field)); invalidate(); }} />{label(field)}</label>;
  return <div className="w-full space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Import participants</h1><p className="text-sm text-muted-foreground">Create eligible learners and safely update existing records from ATF CSV files.</p></div><Button variant="outline" onClick={template}>Download template</Button></div>
    <div className="rounded-xl border bg-muted p-4 text-sm space-y-1"><p>New participants must have reached halfway. A certificate is optional at admission.</p><p>Existing accounts update learning fields by default. Passwords, onboarding, country, cohort, group and team memberships are preserved. Blank cells leave existing values unchanged.</p></div>
    <div className="grid gap-4 rounded-xl border p-5 lg:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="import-cohort">Cohort</Label><select id="import-cohort" className={`${selectClass} w-full`} value={cohortId} disabled={busy} onChange={event => { setCohortId(event.target.value); setGroup(""); invalidate(); }}><option value="">Select a cohort</option>{data?.data.filter(cohort => cohort.status === "active").map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="import-mode">Import mode</Label><select id="import-mode" className={`${selectClass} w-full`} value={mode} disabled={busy} onChange={event => { setMode(event.target.value as ParticipantImportInput["mode"]); invalidate(); }}><option value="create_and_update">Create new and update existing</option><option value="update_only">Update existing only</option><option value="create_only">Create new only</option></select></div>
      {groups.length > 0 && mode !== "update_only" && <div className="space-y-2"><Label htmlFor="import-group">Group for new participants</Label><select id="import-group" className={`${selectClass} w-full`} value={group} disabled={busy} onChange={event => { setGroup(event.target.value); invalidate(); }}><option value="">Select a group</option>{groups.map(name => <option key={name} value={name}>{name}</option>)}</select><p className="text-xs text-muted-foreground">Existing participants keep their group.</p></div>}
    </div>
    {mode !== "create_only" && <div className="space-y-4 rounded-xl border p-5"><p className="font-medium">Fields to update on existing accounts</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PARTICIPANT_LEARNING_FIELDS.map(checkbox)}</div><details><summary className="cursor-pointer text-sm font-medium">Programme status updates</summary><p className="my-3 text-sm text-muted-foreground">Optional columns: opt_out and code_labs_completed. Selecting an opt-out update removes opted-out people from teams and programme chats, cancels pending invitations and pauses affected teams. CodeLabs completion must be verified by staff.</p><div className="grid gap-3 sm:grid-cols-2">{PARTICIPANT_PROGRAMME_IMPORT_FIELDS.map(checkbox)}</div></details><details><summary className="cursor-pointer text-sm font-medium">Optional profile updates</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PARTICIPANT_PROFILE_IMPORT_FIELDS.map(checkbox)}</div></details><label className="flex items-start gap-2 text-sm"><Checkbox checked={allowLearningCorrections} disabled={busy} onCheckedChange={checked => { setAllowLearningCorrections(checked === true); invalidate(); }} /><span>Allow reviewed learning corrections. This permits completion reversals or changed certificate details. Setting certificate issued to No clears its previous ID and date; review every change in the preview.</span></label></div>}
    <div className="space-y-4 rounded-xl border p-5"><div className="space-y-2"><Label htmlFor="participant-csv-file">Participant CSV file</Label><Input id="participant-csv-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { void load(event.target.files?.[0]); event.target.value = ""; }} /></div><details><summary className="cursor-pointer text-sm">Or paste CSV</summary><Textarea aria-label="Participant CSV" className="mt-3 min-h-36 font-mono text-xs" value={csv} disabled={busy} onChange={event => { setCsv(event.target.value); invalidate(); }} /></details><p className="text-xs text-muted-foreground">ATF snake_case headers and existing column aliases are accepted. Update-only files need participant_id and the fields being updated. Up to 5,000 records and 2 MB per file.</p><label className="flex items-center gap-2 text-sm"><Checkbox checked={sendWelcomeEmail} disabled={busy || mode === "update_only"} onCheckedChange={checked => { setSendWelcomeEmail(checked === true); invalidate(); }} />Queue welcome invitations for newly created accounts only</label><Button disabled={busy || !cohortId || !csv.trim() || (mode !== "create_only" && !updateFields.length)} onClick={refresh}>{previewMutation.isPending ? "Preparing preview…" : "Preview import"}</Button></div>
    {preview && <div className="space-y-4">
      {dirty && <p className="text-sm text-amber-600">Refresh the preview after changing the file or options, or before another import.</p>}
      <div className="grid gap-3 sm:grid-cols-5">{Object.entries(preview.counts).map(([name, count]) => <div key={name} className="rounded-xl border p-4"><p className="text-sm capitalize text-muted-foreground">{name}</p><p className="text-xl font-semibold">{count}</p></div>)}</div>
      {preview.errors.map((error, index) => <p key={index} className="text-sm text-destructive" role="alert">{error}</p>)}{preview.warnings.map((warning, index) => <p key={index} className="text-sm text-amber-600">{warning}</p>)}
      {!!preview.counts.conflict && <p className="text-sm text-destructive">Resolve conflicting rows before applying this import. Review each row for its reason.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><select aria-label="Preview row filter" className={selectClass} value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="all">All rows</option>{Object.keys(preview.counts).map(outcome => <option key={outcome} value={outcome}>{outcome}</option>)}</select><p className="text-sm text-muted-foreground">{preview.records.filter(row => row.warnings.length).length} rows have review warnings</p></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["Row", "Participant", "LMS email", "Outcome", "Changes", "Review"].map(name => <th key={name} className="p-3 text-left">{name}</th>)}</tr></thead><tbody>{rows.slice((page - 1) * 25, page * 25).map(row => <tr key={row.row} className="border-t"><td className="p-3">{row.row}</td><td className="p-3"><p>{row.name}</p><p className="text-xs text-muted-foreground">{row.participantId}</p></td><td className="p-3">{row.email || "Not supplied"}</td><td className="p-3 capitalize">{row.outcome}{row.reason && <p className="mt-1 max-w-md text-xs normal-case text-muted-foreground">{row.reason}</p>}</td><td className="p-3">{row.changes.length}{row.warnings.length > 0 && <p className="text-xs text-amber-600">{row.warnings.length} warnings</p>}</td><td className="p-3"><Button size="sm" variant="outline" aria-label={`Review row ${row.row}`} onClick={() => setReview(row)}>Review</Button></td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {page} of {pages} · {rows.length} rows</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(current => current + 1)}>Next</Button></div></div>
      {preview.ready && !writes && <p className="text-sm text-muted-foreground">No changes to apply. These records are already up to date.</p>}<Button disabled={busy || dirty || !preview.ready || !writes} onClick={() => setConfirming(true)}>Review and import</Button>
    </div>}
    {batchId && <div className="space-y-3 rounded-xl border p-5" role="status"><p className="font-medium">{batch?.state === "completed" ? "Participant import complete" : batch?.state === "failed" ? "Participant import failed" : "Importing participants"}</p>{batch?.result.stage && <p className="text-sm capitalize">{batch.result.stage}{batch.result.totalNew !== undefined ? `: ${batch.result.prepared || 0} of ${batch.result.totalNew}` : ""}</p>}{batch?.result.counts && <p className="text-sm">{Object.entries(batch.result.counts).map(([name, count]) => `${count} ${name}`).join(" · ")}</p>}{batch?.error && <p className="text-sm text-destructive">{batch.error}</p>}{batch?.result.invitationState === "queued" && <p className="text-sm">Welcome invitations queued for new accounts. Existing accounts were not sent invitations.</p>}{batch?.result.invitationWarning && <p className="text-sm text-amber-600">{batch.result.invitationWarning}</p>}{!!batch?.result.affectedTeamIds?.length && <p className="text-sm text-muted-foreground">Learning data changed for members of {batch.result.affectedTeamIds.length} teams. Assignments were preserved.</p>}{batchError && <><p className="text-sm text-destructive">Could not load progress.</p><Button variant="outline" onClick={() => refetch()}>Retry progress check</Button></>}{batch?.state === "completed" && <Button variant="outline" onClick={() => download(JSON.stringify(batch, null, 2), `participant-import-${batch.id}.json`, "application/json")}>Download import receipt</Button>}<Button asChild variant="ghost"><Link href="/staff/participants">View participants</Link></Button></div>}
    <Dialog open={confirming} onOpenChange={open => { if (!applyMutation.isPending) setConfirming(open); }}><DialogContent><DialogHeader><DialogTitle>Confirm participant import</DialogTitle><DialogDescription>Create {preview?.counts.new || 0} accounts and update {preview?.counts.updated || 0} existing accounts. {preview?.counts.unchanged || 0} remain unchanged and {preview?.counts.excluded || 0} are excluded.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">{sendWelcomeEmail ? "Only newly created accounts will receive queued welcome invitations." : "No welcome invitations will be sent."} Passwords, onboarding and team assignments on existing accounts are preserved.</p><DialogFooter><Button variant="outline" disabled={applyMutation.isPending} onClick={() => setConfirming(false)}>Cancel</Button><Button disabled={busy || dirty} onClick={apply}>{applyMutation.isPending ? "Queueing…" : "Queue import"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!review} onOpenChange={open => { if (!open) setReview(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Review participant row {review?.row}</DialogTitle><DialogDescription>{review?.name} · {review?.outcome}</DialogDescription></DialogHeader>{review?.reason && <p className="text-sm text-destructive">{review.reason}</p>}{review?.warnings.map((warning, index) => <p key={index} className="text-sm text-amber-600">{warning}</p>)}<p className="font-medium">Changes to apply</p><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Field</th><th className="p-2 text-left">Before</th><th className="p-2 text-left">After</th></tr></thead><tbody>{review?.changes.map(change => <tr key={change.field} className="border-t"><td className="p-2">{label(change.field)}</td><td className="p-2 break-all">{show(change.before)}</td><td className="p-2 break-all">{show(change.after)}</td></tr>)}</tbody></table><details><summary className="cursor-pointer text-sm font-medium">Supplied profile and learning data</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(review?.data || {}).map(([field, value]) => <div key={field}><dt className="text-xs text-muted-foreground">{label(field)}</dt><dd className="break-all text-sm">{show(value)}</dd></div>)}</dl></details></DialogContent></Dialog>
  </div>;
}
