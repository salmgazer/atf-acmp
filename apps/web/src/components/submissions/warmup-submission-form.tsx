"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTeamWorkflow, workflowKey } from "@/lib/api/hooks/use-team-workflow";
import { useStage } from "@/lib/api/hooks/use-stages";
import { useMySubmissionForStage, useSaveDraft, useSubmitSubmission } from "@/lib/api/hooks/use-submissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUtcDeadline } from "@/lib/utc-deadline";

export function WarmupSubmissionForm({ stageId }: { stageId: string }) {
  const workflow = useTeamWorkflow(), stage = useStage(stageId), submission = useMySubmissionForStage(stageId, true);
  const save = useSaveDraft(), submit = useSubmitSubmission(), cache = useQueryClient();
  const [deploymentUrl, setDeploymentUrl] = useState(""), [repositoryUrl, setRepositoryUrl] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (submission.data) { setDeploymentUrl(submission.data.content.deploymentUrl || ""); setRepositoryUrl(submission.data.content.repositoryUrl || submission.data.githubUrl || ""); } }, [submission.data]);
  useEffect(() => { if (submission.data?.status === "evaluated" || submission.data?.status === "rejected") void cache.invalidateQueries({ queryKey: workflowKey }); }, [submission.data?.status, cache]);
  if (workflow.isLoading || stage.isLoading || submission.isLoading) return <p role="status">Loading team warmup…</p>;
  if (workflow.isError || stage.isError || submission.isError || !stage.data) return <p role="alert">Could not load the warmup. <Button onClick={() => { void workflow.refetch(); void stage.refetch(); void submission.refetch(); }}>Retry</Button></p>;
  const team = workflow.data?.team, step = workflow.data?.steps.find(step => step.key === "warmup");
  if (!team || step?.status === "locked") return <p>Submit your proposal and complete the learning checks before starting team warmup. <Link href="/participant/submissions" className="underline">View programme progress</Link></p>;
  const current = submission.data;
  const sameBrief = current?.content.briefId === team.briefId;
  const submitted = sameBrief && !!current && !["draft", "rejected"].includes(current.status);
  const closed = new Date(stage.data.deadline).getTime() < Date.now() && !stage.data.allowLateSubmissions;
  const notOpen = !!stage.data.startDate && Date.parse(stage.data.startDate) > Date.now();
  const readOnly = !workflow.data?.canEdit || submitted || closed || notOpen || !stage.data.requirements.exerciseUrl;
  const busy = save.isPending || submit.isPending;
  return <div className="space-y-6"><Link href="/participant/submissions" className="text-sm underline">Back to programme steps</Link><header className="space-y-2"><h1 className="text-2xl font-bold">Team warmup</h1><p>Build and deploy the ATF to-do-list challenge as a web application.</p><p className="text-sm text-muted-foreground">Deadline: {formatUtcDeadline(stage.data.deadline)}</p></header><section className="space-y-3 rounded-xl border p-5">{stage.data.requirements.exerciseUrl ? <a href={stage.data.requirements.exerciseUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">Open the ATF warmup exercise</a> : <p role="status">ATF will share the exercise link here. Submissions open once it is configured.</p>}{stage.data.instructions && <p className="whitespace-pre-wrap text-sm">{stage.data.instructions}</p>}<p className="text-sm text-muted-foreground">Submit a publicly accessible HTTPS deployment and the GitHub repository containing its code. The warmup repository can differ from your final MVP repository. AI reviews your deployed application and repository.</p></section>{sameBrief && current?.status && <p role="status">Status: {current.status.replace(/_/g, " ")}{["submitted", "late"].includes(current.status) ? " — awaiting AI evaluation. You can leave this page and return later." : ""}</p>}{sameBrief && (current?.rejectionReason || current?.evaluationNotes) && <p className="rounded-lg bg-muted p-4">AI feedback: {current.rejectionReason || current.evaluationNotes}</p>}{["failed", "cancelled"].includes(workflow.data?.warmup?.jobStatus || "") && <p role="alert" className="rounded-lg border border-amber-500 p-4 text-sm">AI evaluation could not finish. Your submission is saved; contact staff to retry the evaluation.</p>}{closed && <p className="text-sm">The submission window is closed. Contact staff if changes are needed.</p>}{notOpen && <p>The warmup submission window has not opened yet.</p>}<form className="space-y-5" onSubmit={e => { e.preventDefault(); void persist(true); }}><fieldset disabled={readOnly || busy} className="space-y-4"><div className="space-y-2"><Label htmlFor="warmup-deployment">Public deployment URL</Label><Input id="warmup-deployment" type="url" maxLength={2000} placeholder="https://your-warmup.example.com" value={deploymentUrl} onChange={e => setDeploymentUrl(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="warmup-repository">Warmup GitHub repository</Label><Input id="warmup-repository" type="url" maxLength={500} placeholder="https://github.com/team/warmup" value={repositoryUrl} onChange={e => setRepositoryUrl(e.target.value)} /></div></fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{!readOnly && <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => persist(false)}>Save draft</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Submit warmup for AI evaluation"}</Button></div>}</form></div>;
  async function persist(final: boolean) {
    setError("");
    try { await (final ? submit : save).mutateAsync({ stageId, content: { deploymentUrl: deploymentUrl.trim(), repositoryUrl: repositoryUrl.trim(), briefId: team!.briefId }, fileUrls: [] }); await cache.invalidateQueries({ queryKey: workflowKey }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save the warmup. Please retry."); }
  }
}
