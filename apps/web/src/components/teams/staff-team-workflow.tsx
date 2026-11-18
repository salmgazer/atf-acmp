"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { TeamWorkflowProgress } from "@/lib/api/hooks/use-team-workflow";
import { StaffOnly } from "@/components/auth/staff-only";
import { Button } from "@/components/ui/button";
import { formatUtcDeadline } from "@/lib/utc-deadline";
export function StaffTeamWorkflow({ teamId }: { teamId: string }) {
  const client = useQueryClient();
  const progress = useQuery({ queryKey: ["admin", "workflow", teamId], queryFn: () => api.get<TeamWorkflowProgress & { resourcesIssuedAt?: string }>(`/admin/team-workflow/teams/${teamId}`) });
  const issued = useMutation({ mutationFn: () => api.post(`/admin/team-workflow/teams/${teamId}/resources-issued`), onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "workflow", teamId] }) });
  if (progress.isLoading) return <p className="text-sm">Loading programme progress…</p>;
  if (progress.isError || !progress.data || !Array.isArray(progress.data.steps)) return <p className="text-sm" role="alert">Programme progress unavailable. <Button variant="ghost" onClick={() => progress.refetch()}>Retry</Button></p>;
  const data = progress.data;
  return <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Programme progress</h2><ol className="space-y-2 text-sm">{data.steps.map(step => <li key={step.key}>{step.number}. {step.name}: {step.completed ? "Completed" : step.status.replace(/_/g, " ")}</li>)}</ol>{data.ownBrief && <Link href={`/staff/briefs/${data.ownBrief.id}`} className="block text-sm underline">Review team brief ({data.ownBrief.status.replace(/_/g, " ")})</Link>}{data.proposal && <Link href={`/staff/submissions/proposals/${data.proposal.id}`} className="block text-sm underline">Review proposal ({data.proposal.status.replace(/_/g, " ")})</Link>}{data.inactiveFor14Days && <p className="text-sm text-amber-600">Flagged: no recorded build activity for 14 days.</p>}{data.resourcesIssuedAt ? <p className="text-sm">Resources issued: {formatUtcDeadline(data.resourcesIssuedAt)}</p> : data.steps.find(step => step.key === "evaluation")?.completed && <div className="space-y-2"><p className="text-sm text-muted-foreground">Issue API credits and compute through ATF&apos;s provider, then record completion here.</p><StaffOnly permission="manage"><Button variant="outline" disabled={issued.isPending} onClick={() => issued.mutate()}>Record resources as issued</Button></StaffOnly></div>}{issued.isError && <p role="alert" className="text-sm text-destructive">{issued.error.message}</p>}</section>;
}
export function InactiveTeams({ cohortId, compact = false }: { cohortId?: string; compact?: boolean }) {
  const { data, isError, refetch } = useQuery({ queryKey: ["admin", "workflow", "inactive", cohortId], enabled: !!cohortId, queryFn: () => api.get<Array<{ id: string; name: string; lastActivityAt: string }>>(`/admin/team-workflow/inactive/${cohortId}`) });
  if (isError) return <p role="alert" className="text-sm">Could not check build inactivity. <Button variant="ghost" onClick={() => refetch()}>Retry</Button></p>;
  if (!Array.isArray(data) || !data.length) return null;
  const contents = <><p className="text-sm text-muted-foreground">These approved teams have no recorded journal, final-submission draft or analysed GitHub push activity for 14 days.</p><ul className="space-y-2 text-sm">{data.map(team => <li key={team.id}><Link className="underline" href={`/staff/teams/${team.id}`}>{team.name}</Link> — last activity {formatUtcDeadline(team.lastActivityAt)}</li>)}</ul></>;
  if (compact) return <details className="rounded-lg border border-amber-500 px-3 py-2"><summary className="cursor-pointer text-sm font-medium">Build activity follow-up ({data.length})</summary><div className="mt-3 space-y-3">{contents}</div></details>;
  return <section className="space-y-3 rounded-xl border border-amber-500 p-5"><h2 className="font-semibold">Build activity follow-up ({data.length})</h2>{contents}</section>;
}
