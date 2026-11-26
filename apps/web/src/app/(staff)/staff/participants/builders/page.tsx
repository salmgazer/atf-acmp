"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Download, Loader2, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StaffOnly, useStaffPermission } from "@/components/auth/staff-only";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GroupFilter } from "@/components/cohorts/group-filter";
import { TablePagination, type PageSize } from "@/components/ui/table-pagination";
import { api } from "@/lib/api/client";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { builderQuery, useBuilders, useBuilderBroadcast, type BuilderFilters, type BuilderBroadcast } from "@/lib/api/hooks/use-builders";
import { useStaffCohortStore } from "@/lib/stores/staff-cohort-store";
import { useAuthStore } from "@/lib/stores/auth-store";

const fieldClass = "h-10 rounded-lg border border-border bg-card px-3 text-sm";
const experience = (value: boolean | null) => value == null ? "Not answered" : value ? "Yes" : "No";

function BuildersContent() {
  const globalCohortId = useStaffCohortStore(s => s.globalCohortId);
  const userId = useAuthStore(s => s.user?.id);
  const canManage = useStaffPermission("manage");
  const [cohortChoice, setCohortChoice] = useState<string | null>(null);
  const cohortId = cohortChoice === "all" ? undefined : cohortChoice || globalCohortId || undefined;
  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState<BuilderFilters["confirmation"]>("all");
  const [assignment, setAssignment] = useState<BuilderFilters["assignment"]>("all");
  const [country, setCountry] = useState("");
  const [group, setGroup] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const filters: BuilderFilters = { cohortId, search: search.trim() || undefined, confirmation, assignment, country: country || undefined, group: group.startsWith("group:") ? group.slice(6) : undefined, ungrouped: group === "ungrouped" || undefined };
  const { data, isPending, error, refetch } = useBuilders(filters, page, pageSize);
  const [exporting, setExporting] = useState(false);
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const storageKey = userId ? `acmp-builder-broadcast:${userId}` : null;
  const { data: batch, error: batchError, refetch: refreshBatch } = useBuilderBroadcast(canManage ? batchId : null);
  const audience = useQuery({ queryKey: ["builder-audience", filters], queryFn: () => api.get<{ total: number; audienceHash: string }>(`/participants/builders/audience?${builderQuery(filters)}`), enabled: compose && canManage, staleTime: 0 });
  const busy = sending || !!batchId && !batchError && (!batch || ["queued", "active"].includes(batch.state));
  const cohortName = cohorts.find(c => c.id === cohortId)?.name || "All cohorts";
  const countries = Array.from(new Set(cohorts.filter(c => !cohortId || c.id === cohortId).flatMap(c => c.countries || []))).sort();
  const groups = Array.from(new Set(cohorts.filter(c => !cohortId || c.id === cohortId).flatMap(c => c.groups || [])));

  useEffect(() => { setGroup("all"); setCountry(""); }, [cohortId]);
  useEffect(() => { setPage(1); setCompose(false); }, [cohortId, search, confirmation, assignment, country, group]);
  useEffect(() => {
    if (!canManage || !storageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved?.id && saved.createdAt > Date.now() - 86400000) setBatchId(saved.id);
    } catch { /* Broadcast progress is optional browser state; delivery stays on the server. */ }
  }, [canManage, storageKey]);

  async function exportBuilders() {
    setExporting(true);
    try {
      const result = await api.get<{ csv: string; total: number }>(`/participants/builders/export?${builderQuery(filters)}`);
      if (!result.total) { toast.error("No builders to export"); return; }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `builders_${cohortName.replace(/[^a-z0-9_-]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click(); URL.revokeObjectURL(url);
      toast.success(`Exported ${result.total} builders`);
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Could not export builders"); }
    finally { setExporting(false); }
  }

  async function sendBroadcast() {
    if (!audience.data || !requestId) return;
    setSending(true);
    try {
      const result = await api.post<BuilderBroadcast>("/participants/builders/broadcasts", { requestId, filters, audienceHash: audience.data.audienceHash, subject: subject.trim(), message: message.trim() });
      setBatchId(result.id);
      if (storageKey) try { sessionStorage.setItem(storageKey, JSON.stringify({ id: result.id, createdAt: Date.now() })); } catch { /* Optional cache. */ }
      setCompose(false); setSubject(""); setMessage("");
      toast.success(`Broadcast queued for ${result.total} builders`);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not queue broadcast");
      void audience.refetch();
    } finally { setSending(false); }
  }

  return <StaffLayout><div className="space-y-5">
    <Link href="/staff/participants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Participants</Link>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Builders</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Confirmed builders and builders awaiting experience confirmation, at every proficiency level.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportBuilders} disabled={exporting || !data?.total}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export builders</Button>
        <StaffOnly permission="manage"><Button onClick={() => { setRequestId(crypto.randomUUID()); setCompose(true); }} disabled={busy || !data?.total}><Mail className="mr-2 h-4 w-4" />Email builders<ArrowRight className="ml-2 h-4 w-4" /></Button></StaffOnly>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Builder summary">
      {[["Total builders", data?.summary.total], ["Confirmed", data?.summary.confirmed], ["Awaiting confirmation", data?.summary.pending], ["Without a team", data?.summary.unassigned]].map(([label, value]) => <div key={label} className="rounded-xl border bg-card px-4 py-3"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative min-w-56 flex-1"><span className="sr-only">Search builders</span><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className={`${fieldClass} w-full pl-10`} placeholder="Search by name, email, or ID…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select className={fieldClass} aria-label="Builder cohort" value={cohortId || "all"} onChange={e => setCohortChoice(e.target.value)}><option value="all">All cohorts</option>{cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={fieldClass} aria-label="Builder confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value as BuilderFilters["confirmation"])}><option value="all">All confirmations</option><option value="confirmed">Confirmed builders</option><option value="pending">Awaiting confirmation</option></select>
      <select className={fieldClass} aria-label="Team assignment" value={assignment} onChange={e => setAssignment(e.target.value as BuilderFilters["assignment"])}><option value="all">All team assignments</option><option value="assigned">Assigned to a team</option><option value="unassigned">Without a team</option></select>
      <select className={fieldClass} aria-label="Builder country" value={country} onChange={e => setCountry(e.target.value)}><option value="">All countries</option>{countries.map(c => <option key={c} value={c}>{c}</option>)}</select>
      <GroupFilter groups={groups} value={group} onChange={setGroup} />
    </div>
    <p className="text-xs text-muted-foreground">Confirmation requires Yes to Development, Testing and Deployment. Preferred language and proficiency do not restrict this list. Deactivated and opted-out participants are excluded.</p>
    {canManage && batchId && <div className="rounded-xl border p-4" role="status">
      {batchError ? <><p>Broadcast progress could not be loaded. Sending may still be in progress.</p><Button variant="outline" className="mt-2" onClick={() => refreshBatch()}>Refresh progress</Button><Button variant="ghost" onClick={() => { setBatchId(null); if (storageKey) try { sessionStorage.removeItem(storageKey); } catch { /* Optional cache. */ } }}>Dismiss</Button></> : batch ? <><p className="font-medium">{batch.state === "completed" ? "Broadcast complete" : "Sending builder broadcast"}: {batch.subject}</p><p className="mt-1 text-sm text-muted-foreground">{batch.processed} of {batch.total} processed · {batch.sent} sent · {batch.failed} failed · {batch.skipped} skipped</p>{batch.failures.length > 0 && <details className="mt-2 text-sm"><summary>Delivery failures</summary>{batch.failures.map(f => <p key={f.participantId}>{f.participantId}: {f.message}</p>)}</details>}</> : <p>Loading broadcast progress…</p>}
    </div>}
    {error ? <div role="alert" className="rounded-xl border p-6"><p>{error.message}</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Try again</Button></div> : <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm"><thead className="bg-muted text-left text-muted-foreground"><tr>{["Builder", "Participant ID", "Language", "Experience", "Confirmation", "Group", "Team"].map(heading => <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody>{isPending ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Loading builders…</td></tr> : !data?.data.length ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No builders match these filters.</td></tr> : data.data.map(builder => <tr key={builder.id} className="border-t hover:bg-muted/40">
          <td className="max-w-64 p-4"><Link href={`/staff/participants/${builder.id}`} className="font-medium hover:underline">{builder.firstName} {builder.lastName}</Link><p className="truncate text-xs text-muted-foreground" title={builder.email}>{builder.email}</p><p className="mt-1 text-xs text-muted-foreground">{builder.country}{!cohortId ? ` · ${builder.cohortName}` : ""}</p></td>
          <td className="whitespace-nowrap p-4 font-mono text-xs">{builder.participantId}</td>
          <td className="p-4">{builder.preferredLanguage === "Other" ? builder.otherLanguage : builder.preferredLanguage || "Not selected"}<p className="mt-1 text-xs text-muted-foreground">{builder.languageProficiency || "Proficiency not provided"}</p></td>
          <td className="whitespace-nowrap p-4 text-xs">{[["Development", builder.developmentExperience], ["Testing", builder.testingExperience], ["Deployment", builder.deploymentExperience]].map(([label, value]) => <p key={String(label)} className="flex items-center gap-1.5">{value === true && <Check className="h-3 w-3 text-emerald-600" />}{label}: {experience(value as boolean | null)}</p>)}</td>
          <td className="p-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${builder.builderConfirm ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{builder.builderConfirm ? "Confirmed" : "Awaiting confirmation"}</span></td>
          <td className="p-4">{builder.group || <span className="text-muted-foreground">Not assigned</span>}</td>
          <td className="p-4">{builder.teamId ? <Link className="font-medium hover:underline" href={`/staff/teams/${builder.teamId}`}>{builder.teamName}</Link> : <span className="text-muted-foreground">Not assigned</span>}</td>
        </tr>)}</tbody></table>
    </div>}
    <div className="overflow-x-auto"><TablePagination page={page} pageSize={pageSize} totalPages={Math.max(data?.totalPages || 1, 1)} totalItems={data?.total || 0} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></div>
    <Dialog open={compose} onOpenChange={open => { if (!sending) setCompose(open); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Email builders</DialogTitle><DialogDescription>Send a separate branded email to each builder matching the current filters, across all pages. Recipients cannot see each other’s email addresses.</DialogDescription></DialogHeader>
      <div className="rounded-lg bg-muted p-3 text-sm"><p className="font-medium">{cohortName} · {confirmation === "all" ? "All confirmations" : confirmation === "confirmed" ? "Confirmed builders" : "Awaiting confirmation"}</p><p>{assignment === "all" ? "All team assignments" : assignment === "assigned" ? "Assigned to a team" : "Without a team"}{country ? ` · ${country}` : ""}{group !== "all" ? ` · ${group === "ungrouped" ? "No group" : group.slice(6)}` : ""}{search.trim() ? ` · Search: ${search.trim()}` : ""}</p><p className="mt-1">{audience.isFetching ? "Checking recipients…" : audience.data ? `${audience.data.total} builders will receive this email` : "Could not load recipients"}</p>{audience.error && <Button variant="outline" size="sm" className="mt-2" onClick={() => audience.refetch()}>Retry recipient check</Button>}</div>
      <div className="space-y-1 text-sm font-medium"><label htmlFor="builder-broadcast-subject">Subject</label><input id="builder-broadcast-subject" className={`${fieldClass} w-full`} value={subject} maxLength={200} disabled={sending} onChange={e => { setSubject(e.target.value); setRequestId(crypto.randomUUID()); }} /></div>
      <div className="space-y-1 text-sm font-medium"><label htmlFor="builder-broadcast-message">Message</label><textarea id="builder-broadcast-message" className="min-h-52 w-full rounded-lg border bg-background p-3 text-sm font-normal" value={message} maxLength={20000} disabled={sending} onChange={e => { setMessage(e.target.value); setRequestId(crypto.randomUUID()); }} /></div>
      <p className="text-xs text-muted-foreground">Your message is sent as plain text inside the ATF email template, with the ATF logo and a personal greeting.</p>
      {message.trim() && <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Preview message</summary><p className="mt-3 font-semibold">{subject}</p><p className="mt-3">Hi [First name],</p><p className="mt-3 whitespace-pre-wrap break-words">{message}</p><p className="mt-3">The ATF Team</p></details>}
      <DialogFooter><Button variant="outline" onClick={() => setCompose(false)} disabled={sending}>Cancel</Button><Button onClick={sendBroadcast} disabled={sending || audience.isFetching || audience.isError || !audience.data?.total || !subject.trim() || !message.trim()}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send broadcast{audience.data?.total ? ` to ${audience.data.total} builders` : ""}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div></StaffLayout>;
}

export default function BuildersPage() { return <ProtectedRoute portal="staff"><BuildersContent /></ProtectedRoute>; }
