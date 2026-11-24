"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormAnswers, PROPOSAL_FIELDS, TEAM_BRIEF_FIELDS, validateProgrammeForm } from "@acmp/shared";
import { api } from "@/lib/api/client";
import { useOwnTeamBrief, useTeamWorkflow, workflowKey } from "@/lib/api/hooks/use-team-workflow";
import { FileUrl, useMySubmissionForStage, useSaveDraft, useSubmitSubmission } from "@/lib/api/hooks/use-submissions";
import { useStage } from "@/lib/api/hooks/use-stages";
import { ProgrammeFields } from "./programme-fields";
import { ProgrammeAttachments } from "./programme-attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatUtcDeadline } from "@/lib/utc-deadline";

export function ProgrammeSubmissionForm({ kind, stageId = "" }: { kind: "brief" | "proposal" | "build"; stageId?: string }) {
  const client = useQueryClient(), workflow = useTeamWorkflow(), own = useOwnTeamBrief(kind === "brief");
  const stage = useStage(stageId), existing = useMySubmissionForStage(stageId);
  const draft = useSaveDraft(), submit = useSubmitSubmission();
  const [answers, setAnswers] = useState<FormAnswers>({}), [files, setFiles] = useState<FileUrl[]>([]), [videoUrl, setVideoUrl] = useState("");
  const [errors, setErrors] = useState<string[]>([]), [uploading, setUploading] = useState(false), [saved, setSaved] = useState(false);
  const current = kind === "brief" ? own.data : existing.data;
  useEffect(() => {
    const record = kind === "brief" ? own.data : existing.data;
    if (record) { setAnswers("answers" in record ? record.answers : record.content); setFiles(record.fileUrls || []); setVideoUrl("videoUrl" in record ? record.videoUrl || "" : ""); }
  }, [kind, own.data, existing.data]);
  const briefSave = useMutation({ mutationFn: (final: boolean) => api.post("/team-workflow/brief", { answers, fileUrls: files, submit: final }), onSuccess: () => client.invalidateQueries({ queryKey: workflowKey }) });
  const busy = draft.isPending || submit.isPending || briefSave.isPending || uploading;
  if (workflow.isLoading || (kind === "brief" ? own.isLoading : stage.isLoading || existing.isLoading)) return <p role="status">Loading submission…</p>;
  if (workflow.isError || (kind === "brief" ? own.isError : stage.isError || existing.isError)) return <div role="alert">Could not load the form. <Button onClick={() => { workflow.refetch(); own.refetch(); stage.refetch(); existing.refetch(); }}>Retry</Button></div>;
  if (!workflow.data?.team) return <p>Join a confirmed team first. <Link href="/participant/team" className="underline">Go to teams</Link></p>;
  const team = workflow.data.team;
  if (kind === "brief" && team.briefPreference !== "own") return <p>Choose “Create our own brief” on your team page first. <Link href="/participant/team" className="underline">Open team settings</Link></p>;
  const step = workflow.data.steps.find(item => item.key === (kind === "brief" ? "problem" : kind));
  if (kind !== "brief" && step?.status === "locked") return <p>Complete the previous steps and eligibility checks before opening this form. <Link href="/participant/submissions" className="underline">View the six steps</Link></p>;
  const forNewBrief = kind !== "brief" && !!existing.data?.content.briefId && existing.data.content.briefId !== team.briefId;
  const submitted = !forNewBrief && !!current && !["draft", "rejected", "revision_requested"].includes(current.status);
  const deadline = kind === "brief" ? workflow.data.steps.find(item => item.key === "problem")?.deadline : stage.data?.deadline;
  const closed = !!deadline && new Date(deadline).getTime() < Date.now() && !stage.data?.allowLateSubmissions;
  const notYetOpen = !!(kind === "brief" ? step?.startDate : stage.data?.startDate) && new Date((kind === "brief" ? step?.startDate : stage.data?.startDate)!).getTime() > Date.now();
  const canEdit = kind === "brief" ? workflow.data.canSubmitOwnBrief : workflow.data.canEdit;
  const readOnly = !canEdit || submitted || closed || notYetOpen;
  const fields = kind === "brief" ? TEAM_BRIEF_FIELDS : PROPOSAL_FIELDS;
  const repositoryUrl = submitted && existing.data?.githubUrl ? existing.data.githubUrl : team.githubRepoUrl;
  async function save(final: boolean) {
    setErrors([]); setSaved(false);
    const problems = kind === "build" ? [] : validateProgrammeForm(fields, answers, final);
    if (kind === "build" && final) {
      if (!videoUrl) problems.push("Upload an MP4 video");
      if (!files.some(file => /\.pptx?$/i.test(file.name))) problems.push("Upload PowerPoint slides (PPT or PPTX)");
      if (!team.githubRepoUrl) problems.push("Add your GitHub repository on the team page first");
      if (answers.acceptApacheLicense !== true) problems.push("Confirm the Apache 2.0 code declaration");
    }
    if (problems.length) { setErrors(problems); return; }
    try {
      if (kind === "brief") await briefSave.mutateAsync(final);
      else { const payload = { stageId, content: { ...answers, briefId: team.briefId }, fileUrls: files, videoUrl: videoUrl || undefined }; await (final ? submit.mutateAsync(payload) : draft.mutateAsync(payload)); }
      await client.invalidateQueries({ queryKey: workflowKey }); setSaved(true);
      if (kind === "brief") toast.success(final ? "Brief submitted for ATF review" : "Brief draft saved");
    } catch (error) { setErrors([error instanceof Error ? error.message : "Could not save. Please retry."]); }
  }
  return <div className="space-y-6"><Link href="/participant/submissions" className="text-sm underline">Back to the six steps</Link><div><h1 className="text-2xl font-bold">{kind === "brief" ? "Your team's problem brief" : kind === "proposal" ? "Team proposal" : "Final MVP submission"}</h1><p className="mt-2 text-muted-foreground">{kind === "brief" ? "Describe the problem, not the solution. ATF must approve it before you submit a proposal. Team and member details are taken from your team profile." : kind === "proposal" ? `For your assigned brief: ${team.briefTitle || "No brief assigned"}. Team details are taken from your profile.` : "Submit your MVP video, slides and supporting documents."}</p>{deadline && <p className="mt-2 text-sm">Deadline: {formatUtcDeadline(deadline)}</p>}</div>
    {forNewBrief && <p className="rounded-lg border p-4 text-sm">Your assigned brief has changed. Review and revise these materials for the new brief; previous versions will be preserved.</p>}
    <p className="text-sm text-muted-foreground">Team: {team.name}</p>
    {current?.status && <p className="rounded-lg bg-muted p-3 text-sm">Status: {current.status.replace(/_/g, " ")}</p>}
    {kind === "brief" && own.data?.reviewFeedback && <p className="rounded-lg border p-4">ATF feedback: {own.data.reviewFeedback}</p>}
    {notYetOpen && <p className="text-sm text-muted-foreground">This submission window has not opened yet.</p>}
    {closed && <p className="text-sm text-amber-600">The submission window is closed. Contact staff if changes are needed.</p>}
    {!canEdit && <p className="text-sm text-muted-foreground">{kind === "brief" ? "Only the team lead can edit this form." : "Only the team lead or co-lead can edit this form."}</p>}
    <form onSubmit={event => { event.preventDefault(); void save(false); }} className="space-y-6"><fieldset disabled={busy || readOnly} className="space-y-6 min-w-0">
      {kind !== "build" ? <ProgrammeFields fields={fields} answers={answers} onChange={value => { setAnswers(value); setSaved(false); }} readOnly={readOnly} /> : <section className="space-y-5 rounded-xl border bg-card p-5"><h2 className="font-semibold">MVP materials</h2><p className="text-sm">GitHub repository: {repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" className="underline">{repositoryUrl}</a> : <Link href="/participant/team" className="underline">Add the repository on your team page</Link>}</p><Label htmlFor="mvp-video">MP4 demo video (required; maximum 100 MB)</Label>{videoUrl && <video controls src={videoUrl} className="w-full max-w-xl rounded-lg" />}{!readOnly && <Input id="mvp-video" type="file" accept="video/mp4,.mp4" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
        if (!file.name.toLowerCase().endsWith(".mp4") || file.size > 100 * 1024 * 1024) { setErrors(["Choose an MP4 video up to 100 MB"]); return; }
        setUploading(true); setErrors([]); try { const body = new FormData(); body.append("file", file); const result = await api.post<{ url: string }>("/submissions/upload-video", body); setVideoUrl(result.url); setSaved(false); } catch (error) { setErrors([error instanceof Error ? error.message : "Video upload failed"]); } finally { setUploading(false); }
      }} />}<label className="flex items-center gap-2 text-sm"><Checkbox checked={answers.acceptApacheLicense === true} onCheckedChange={value => setAnswers({ ...answers, acceptApacheLicense: value === true })} />We confirm the submitted code is under Apache 2.0.</label><p className="text-sm text-muted-foreground">Add PowerPoint slides below. You may also include user-testing evidence and other supporting documents.</p></section>}
      <ProgrammeAttachments files={files} change={setFiles} readOnly={readOnly} requiredSlides={kind === "build"} onBusy={setUploading} />
    </fieldset>
    {errors.length > 0 && <div role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive"><p>Please resolve these issues:</p><ul className="mt-2 list-disc pl-5">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
    {saved && <p role="status" className="text-sm text-green-600">Saved successfully.</p>}
    {!readOnly && <div className="flex flex-wrap gap-3"><Button type="submit" variant="outline" disabled={busy}>Save draft</Button><Button type="button" disabled={busy} onClick={() => save(true)}>{busy ? "Saving…" : kind === "brief" ? "Submit brief for review" : kind === "proposal" ? "Submit proposal" : "Submit MVP"}</Button></div>}</form>
  </div>;
}
