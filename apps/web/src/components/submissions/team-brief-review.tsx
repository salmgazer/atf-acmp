"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TEAM_BRIEF_FIELDS, FormAnswers } from "@acmp/shared";
import { api } from "@/lib/api/client";
import { FileUrl } from "@/lib/api/hooks/use-submissions";
import { ProgrammeFields } from "./programme-fields";
import { ProgrammeAttachments } from "./programme-attachments";
import { StaffOnly } from "@/components/auth/staff-only";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
export function TeamBriefReview({ briefId, status }: { briefId: string; status: string }) {
  const client = useQueryClient(), [feedback, setFeedback] = useState(""), [verified, setVerified] = useState(false);
  const details = useQuery({ queryKey: ["admin", "team-brief", briefId], queryFn: () => api.get<{ answers: FormAnswers; fileUrls: FileUrl[]; minimumConsultations: number }>(`/admin/team-workflow/briefs/${briefId}`) });
  const review = useMutation({ mutationFn: (action: string) => api.post(`/admin/team-workflow/briefs/${briefId}/review`, { action, feedback, contactVerified: verified }), onSuccess: () => { client.invalidateQueries({ queryKey: ["briefs"] }); client.invalidateQueries({ queryKey: ["admin", "team-brief", briefId] }); } });
  if (details.isLoading) return <p>Loading team evidence…</p>;
  if (details.isError || !details.data) return <p role="alert">Could not load the private team brief answers. <Button onClick={() => details.refetch()}>Retry</Button></p>;
  return <section className="space-y-5"><div className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Team brief review</h2><p className="mt-2 text-sm text-muted-foreground">Review problem evidence, contact support, sensitivities and conflicts. Fit and impact are separate scores. Approval links this brief to its originating team. Other teams can see it only with explicit sharing consent.</p><p className="mt-2 text-sm">Minimum consultations: {details.data.minimumConsultations}. New data-option scores currently use the draft&apos;s recommended 25 / 12 points.</p></div><ProgrammeFields fields={TEAM_BRIEF_FIELDS} answers={details.data.answers} readOnly /><ProgrammeAttachments files={details.data.fileUrls || []} change={() => {}} readOnly />{["submitted", "in_review"].includes(status) && <StaffOnly permission="review"><div className="space-y-4 rounded-xl border bg-card p-5"><Label htmlFor="team-brief-review-feedback">Review reason (required)</Label><Textarea id="team-brief-review-feedback" maxLength={5000} value={feedback} onChange={event => setFeedback(event.target.value)} /><label className="flex items-center gap-2 text-sm"><Checkbox checked={verified} onCheckedChange={value => setVerified(value === true)} />I verified the contact&apos;s support and scored answers on a call.</label>{review.isError && <p role="alert" className="text-sm text-destructive">{review.error.message}</p>}<div className="flex flex-wrap gap-2"><Button disabled={!feedback.trim() || review.isPending} onClick={() => review.mutate("approved")}>Approve team brief</Button><Button variant="outline" disabled={!feedback.trim() || review.isPending} onClick={() => review.mutate("revision_requested")}>Request changes</Button><Button variant="destructive" disabled={!feedback.trim() || review.isPending} onClick={() => review.mutate("rejected")}>Decline brief</Button></div></div></StaffOnly>}</section>;
}
