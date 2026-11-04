"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useApplySubmissionImport, usePreviewSubmissionImport, type SubmissionImportPreview, type SubmissionImportReceipt } from "@/lib/api/hooks/use-submission-import";

export function SubmissionImportPanel() {
  const { data } = useCohorts({ limit: 100 });
  const [cohortId, setCohortId] = useState("");
  const [csv, setCsv] = useState("");
  const [sourceName, setSourceName] = useState("partner-submissions.csv");
  const [sourceTimezone, setSourceTimezone] = useState("Africa/Accra");
  const [primaryContacts, setPrimaryContacts] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<SubmissionImportPreview | null>(null);
  const [dirty, setDirty] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<SubmissionImportReceipt | null>(null);
  const previewMutation = usePreviewSubmissionImport(), applyMutation = useApplySubmissionImport();
  const busy = previewMutation.isPending || applyMutation.isPending;
  const input = { cohortId, csv, sourceName, sourceTimezone, primaryContacts };
  const invalidate = () => { setDirty(true); setReceipt(null); };
  const refresh = async () => {
    try { const result = await previewMutation.mutateAsync(input); setPreview(result); setDirty(false); setReceipt(null); }
    catch { setDirty(true); }
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 500000) { toast.error("Choose a CSV smaller than 500 KB"); return; }
    try { setCsv(await file.text()); setSourceName(file.name); setPrimaryContacts({}); setPreview(null); invalidate(); }
    catch { toast.error("Could not read the CSV file"); }
  };
  const apply = async () => {
    if (!preview?.ready || dirty) return;
    try { setReceipt(await applyMutation.mutateAsync({ ...input, previewHash: preview.previewHash })); setConfirming(false); setDirty(true); }
    catch { setConfirming(false); setDirty(true); }
  };
  const downloadReceipt = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `partner-import-${receipt?.batchId}.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <section aria-label="Import partner brief submissions" className="space-y-5">
    <p className="text-sm text-muted-foreground">Upload the original country submission CSV to load partners and their briefs together. Repeated submissions are grouped under one partner. Main contacts and submitters remain associated with each brief.</p>
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="submission-cohort">Cohort</Label><select id="submission-cohort" value={cohortId} disabled={busy} onChange={event => { setCohortId(event.target.value); invalidate(); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">Select a cohort</option>{data?.data.map(cohort => <option key={cohort.id} value={cohort.id} disabled={cohort.status !== "active"}>{cohort.name}{cohort.status !== "active" ? ` (${cohort.status})` : ""}</option>)}
      </select></div>
      <div className="space-y-2"><Label htmlFor="submission-timezone">Source timestamp timezone</Label><Input id="submission-timezone" value={sourceTimezone} disabled={busy} onChange={event => { setSourceTimezone(event.target.value); invalidate(); }} /><p className="text-xs text-muted-foreground">Use the spreadsheet’s timezone, for example Africa/Accra or Africa/Nairobi.</p></div>
      <div className="space-y-2"><Label htmlFor="submission-file">Partner brief submissions CSV</Label><Input id="submission-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={event => loadFile(event.target.files?.[0])} /></div>
      <div className="space-y-2"><Label htmlFor="submission-source">Source name</Label><Input id="submission-source" value={sourceName} disabled={busy} onChange={event => { setSourceName(event.target.value); invalidate(); }} /></div>
    </div>
    <div className="space-y-2"><Label htmlFor="submission-csv">Submission CSV data</Label><Textarea id="submission-csv" value={csv} disabled={busy} rows={6} placeholder="Paste the original submission CSV, including its column headers" onChange={event => { setCsv(event.target.value); setPrimaryContacts({}); setPreview(null); invalidate(); }} className="font-mono text-xs" /></div>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={busy || !cohortId || !csv.trim() || !sourceName.trim() || !sourceTimezone.trim()} variant="outline" onClick={refresh}>{previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{preview ? "Refresh preview" : "Preview import"}</Button><span className="text-sm text-muted-foreground">Preview does not create records or send email.</span></div>
    {preview && !receipt && <div className="space-y-4">
      <div role="status" className="rounded-xl border p-4"><p className="font-medium">{preview.totalBriefs} source briefs · {preview.newPartners} new partners · {preview.newUsers} new accounts · {preview.newBriefs} new briefs · {preview.skippedBriefs} already imported</p>
        <p className="mt-2 text-sm text-muted-foreground">Partners load as Pending and briefs as Submitted. No invitations are sent. Consent absent from the source remains unconfirmed.</p>
        {dirty && <p className="mt-2 text-sm text-amber-600">Selections changed. Refresh the preview before importing.</p>}
      </div>
      {preview.errors.length > 0 && <div role="alert" className="rounded-xl border border-destructive p-4 text-sm"><p className="font-medium">Resolve these issues before importing:</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.errors.map((error, index) => <li key={index}>{error.row ? `Row ${error.row}: ` : ""}{error.message}</li>)}</ul></div>}
      {preview.warnings.length > 0 && <div className="rounded-xl border p-4 text-sm"><p className="font-medium">Import notes</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning.row ? `Row ${warning.row}: ` : ""}{warning.message}</li>)}</ul></div>}
      {preview.organizations.length > 0 && <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Partner</th><th className="p-3 text-left">Partner main contact</th><th className="p-3 text-left">Briefs</th></tr></thead><tbody>{preview.organizations.map(org => <tr key={org.key} className="border-t">
        <td className="p-3">{org.name}<span className="block text-xs text-muted-foreground">{org.country}{org.organizationId ? " · Existing partner" : ""}</span></td>
        <td className="p-3"><select aria-label={`Main contact for ${org.name}`} value={primaryContacts[org.key] || org.primaryEmail} disabled={busy || !!org.organizationId} onChange={event => { setPrimaryContacts(contacts => ({ ...contacts, [org.key]: event.target.value })); invalidate(); }} className="h-10 w-full min-w-48 rounded-md border bg-background px-2">{org.primaryCandidates.map(contact => <option key={contact.email} value={contact.email}>{contact.name} ({contact.email})</option>)}</select></td>
        <td className="p-3">{org.newBriefs} new · {org.skippedBriefs} existing</td>
      </tr>)}</tbody></table></div>}
      {!!preview.briefs?.length && <div className="space-y-2"><h2 className="font-medium">Brief contacts and scores</h2><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Brief</th><th className="p-3 text-left">Main contact / event host</th><th className="p-3 text-left">Submitter</th><th className="p-3 text-left">Scores</th></tr></thead><tbody>{preview.briefs.map(brief => <tr key={brief.row} className="border-t align-top">
        <td className="p-3"><p className="font-medium">{brief.title}</p><p className="text-xs text-muted-foreground">Row {brief.row} · {brief.partner} · {brief.status === "skipped" ? "Already imported" : "New"}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en", { timeZone: preview.sourceTimezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(brief.submittedAt))} ({preview.sourceTimezone})</p></td>
        <td className="p-3"><p>{brief.host.name}</p><p className="text-xs text-muted-foreground">{brief.host.email}</p>{brief.host.source === "partner" && <p className="text-xs text-muted-foreground">Partner main contact fallback</p>}</td>
        <td className="p-3"><p>{brief.submitter.name}</p><p className="text-xs text-muted-foreground">{brief.submitter.email}</p></td>
        <td className="p-3">Fit: {brief.fitScore}<p className="text-xs text-muted-foreground">Impact: {brief.impactScore ?? "Not provided"}</p></td>
      </tr>)}</tbody></table></div></div>}
      <Button disabled={busy || dirty || !preview.ready || !preview.newBriefs} onClick={() => setConfirming(true)}><Upload className="mr-2 h-4 w-4" />Import partners and briefs</Button>
      {!dirty && preview.ready && !preview.newBriefs && <p className="text-sm text-muted-foreground">All source briefs have already been imported. Nothing new to load.</p>}
    </div>}
    {receipt && <div role="status" className="space-y-3 rounded-xl border p-4"><h2 className="font-medium">Import complete</h2><p className="text-sm">{receipt.createdPartners} partners, {receipt.createdUsers} accounts and {receipt.createdBriefs} briefs created. {receipt.skippedBriefs} previously imported briefs skipped.</p><p className="break-all text-xs text-muted-foreground">Receipt: {receipt.batchId}</p><div className="flex gap-2"><Button variant="outline" onClick={downloadReceipt}><Download className="mr-2 h-4 w-4" />Download receipt</Button><Button asChild><Link href="/staff/partners">View partners</Link></Button></div></div>}
    <Dialog open={confirming} onOpenChange={open => { if (!applyMutation.isPending) setConfirming(open); }}><DialogContent><DialogHeader><DialogTitle>Import partners and briefs?</DialogTitle><DialogDescription>Load {preview?.newBriefs} briefs and {preview?.newPartners} new partners into {data?.data.find(cohort => cohort.id === cohortId)?.name} from {sourceName}?</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">The selected partner main contacts become owners of new partners. Other contacts receive member logins and can host events only for briefs where they are the designated host. No email is sent during import.</p><DialogFooter><Button variant="outline" disabled={applyMutation.isPending} onClick={() => setConfirming(false)}>Cancel</Button><Button disabled={busy || dirty || !preview?.ready} onClick={apply}>{applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm import</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
