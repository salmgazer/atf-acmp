"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROPOSAL_FIELDS } from "@acmp/shared";
import { api } from "@/lib/api/client";
import { useAdminSubmission, useApproveSubmission, useRejectSubmission } from "@/lib/api/hooks/use-submissions";
import { ProgrammeFields } from "./programme-fields";
import { ProgrammeAttachments } from "./programme-attachments";
import { StaffOnly } from "@/components/auth/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
const criteria = [{ id: "problem", name: "Understanding of the problem" }, { id: "solution", name: "Solution and AI fit" }, { id: "feasibility", name: "Feasibility and delivery" }, { id: "responsible_ai", name: "Responsible AI" }, { id: "impact", name: "Impact and post-challenge plan" }, { id: "capacity", name: "Team capacity" }];
export function ProposalReview({ submissionId }: { submissionId: string }) {
  const { data, isLoading, isError, refetch } = useAdminSubmission(submissionId), client = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({}), [notes, setNotes] = useState(""), [decisionError, setDecisionError] = useState("");
  useEffect(() => { if (data) { setScores(data.feedback?.proposalScores || {}); setNotes(data.evaluationNotes || ""); } }, [data]);
  const evaluate = useMutation({ mutationFn: () => api.post(`/admin/submissions/${submissionId}/evaluate`, { criterionScores: scores, evaluationNotes: notes }), onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "submissions"] }) });
  const approve = useApproveSubmission(), reject = useRejectSubmission();
  if (isLoading) return <p>Loading proposal…</p>;
  if (isError || !data) return <p role="alert">Could not load the proposal. <Button onClick={() => refetch()}>Retry</Button></p>;
  if (data.stage?.workflowKey !== "proposal") return <p>This is not a proposal submission.</p>;
  const canReview = ["submitted", "approved", "pending_approval", "evaluated", "late"].includes(data.status);
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Proposal review — {data.team?.name}</h1><p className="text-sm">Status: {data.status.replace(/_/g, " ")}</p><Link href={`/staff/teams/${data.teamId}`} className="block text-sm underline">View team profile and members</Link><ProgrammeFields fields={PROPOSAL_FIELDS} answers={data.content} readOnly /><ProgrammeAttachments files={data.fileUrls || []} change={() => {}} readOnly /><StaffOnly permission="review"><section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Reviewer assessment</h2><p className="text-sm text-muted-foreground">Record each criterion from 0 to 5. Scores provide feedback to the team. In the six-step programme, a submitted proposal and a successfully evaluated warmup unlock building.</p><fieldset disabled={!canReview || evaluate.isPending || approve.isPending || reject.isPending} className="space-y-4">{criteria.map(item => <div key={item.id}><Label htmlFor={`score-${item.id}`}>{item.name}</Label><Input id={`score-${item.id}`} type="number" min={0} max={5} step={0.5} value={scores[item.id] ?? ""} onChange={event => { const next = { ...scores }; if (event.target.value === "") delete next[item.id]; else next[item.id] = Number(event.target.value); setScores(next); }} /></div>)}<Label htmlFor="proposal-review-notes">Feedback to the team</Label><Textarea id="proposal-review-notes" value={notes} maxLength={5000} onChange={event => setNotes(event.target.value)} /><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={criteria.some(item => scores[item.id] === undefined)} onClick={() => evaluate.mutate()}>Save criterion scores</Button><Button disabled={!data.evaluatedAt || !data.feedback?.proposalScores || !notes.trim() || evaluate.isPending} onClick={async () => { setDecisionError(""); try { await approve.mutateAsync({ id: submissionId, approvalNotes: notes }); } catch (error) { setDecisionError(error instanceof Error ? error.message : "Approval failed"); } }}>Approve proposal</Button><Button variant="destructive" disabled={!notes.trim()} onClick={async () => { setDecisionError(""); try { await reject.mutateAsync({ id: submissionId, rejectionReason: notes }); } catch (error) { setDecisionError(error instanceof Error ? error.message : "Request failed"); } }}>Request changes</Button></div></fieldset>{(evaluate.isError || decisionError) && <p role="alert" className="text-sm text-destructive">{decisionError || evaluate.error?.message}</p>}{evaluate.isSuccess && <p role="status" className="text-sm">Criterion scores saved.</p>}</section></StaffOnly></div>;
}
