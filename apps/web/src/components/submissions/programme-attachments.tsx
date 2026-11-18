"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { FileUrl } from "@/lib/api/hooks/use-submissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export function ProgrammeAttachments({ files, change, readOnly = false, requiredSlides = false, onBusy }: { files: FileUrl[]; change: (files: FileUrl[]) => void; readOnly?: boolean; requiredSlides?: boolean; onBusy?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">{requiredSlides ? "PowerPoint slides and supporting documents" : "Supporting documents"}</h2><p className="text-sm text-muted-foreground">{requiredSlides ? "PowerPoint slides are required; other documents are optional." : "Optional."} Up to 10 files, 25 MB each: PDF, Office documents, TXT or CSV.</p>{files.map((file, index) => <div key={file.url} className="flex items-center gap-3"><a href={file.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline">{file.name}</a>{!readOnly && <Button variant="ghost" type="button" disabled={busy} onClick={() => change(files.filter((_, i) => i !== index))}>Remove</Button>}</div>)}{!readOnly && <><Label htmlFor="programme-attachment">Upload document</Label><Input id="programme-attachment" type="file" disabled={busy || files.length >= 10} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" onChange={async event => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = ""; setError("");
    if (file.size > 25 * 1024 * 1024) { setError("The document must be 25 MB or smaller"); return; }
    setBusy(true); onBusy?.(true); try { const body = new FormData(); body.append("file", file); const uploaded = await api.post<FileUrl>("/submissions/upload-document", body); change([...files, uploaded]); }
    catch (error) { setError(error instanceof Error ? error.message : "Upload failed; please retry"); } finally { setBusy(false); onBusy?.(false); }
  }} />{busy && <p role="status" className="text-sm">Uploading…</p>}</>}{error && <p role="alert" className="text-destructive">{error}</p>}</section>;
}
