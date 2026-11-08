"use client";
import { formatUtcDeadline } from "@/lib/utc-deadline";
import { useEffect, useState } from "react";
import { useCohort, useUpdateCohort } from "@/lib/api/hooks/use-cohorts";
import { useStages } from "@/lib/api/hooks/use-stages";
import { useAuthStore } from "@/lib/stores/auth-store";
import { hasStaffPermission } from "@acmp/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
const utc = formatUtcDeadline;
export function TeamDeadlineStages({ cohortId }: { cohortId: string }) {
  const { data: cohort, isError: cohortError } = useCohort(cohortId), { data: stages, isError: stageError } = useStages(cohortId);
  const role = useAuthStore(state => state.user?.role), canManage = hasStaffPermission(role, "manage"), update = useUpdateCohort();
  const [joining, setJoining] = useState(""), [certification, setCertification] = useState("");
  useEffect(() => { setJoining(cohort?.teamJoiningStageId || ""); setCertification(cohort?.learningCertificationStageId || ""); }, [cohort?.id, cohort?.teamJoiningStageId, cohort?.learningCertificationStageId]);
  if (cohortError || stageError) return <div className="rounded-xl border p-5 text-sm text-destructive">Could not load the cohort&apos;s team deadline configuration.</div>;
  if (!cohort || !stages) return <div className="rounded-xl border p-5 text-sm">Loading team deadline stages…</div>;
  const changed = joining !== (cohort.teamJoiningStageId || "") || certification !== (cohort.learningCertificationStageId || "");
  const selectedJoin = stages.find(stage => stage.id === joining), selectedCertificate = stages.find(stage => stage.id === certification);
  const wrongOrder = !!selectedJoin && !!selectedCertificate && Date.parse(selectedJoin.deadline) > Date.parse(selectedCertificate.deadline);
  const save = async () => { try { await update.mutateAsync({ id: cohortId, data: { teamJoiningStageId: joining || null, learningCertificationStageId: certification || null } }); } catch { /* Mutation reports the failure. */ } };
  return <section className="space-y-4 rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">Team deadline stages</h2><p className="text-sm text-muted-foreground">Choose which stage deadlines close team joining/registration and learning certification. Editing a selected stage updates the team rules automatically. There are no fallback dates.</p><div className="grid gap-4 lg:grid-cols-2">{([{ key: "joining", title: "Team joining deadline stage", value: joining, change: setJoining }, { key: "certification", title: "Learning certification deadline stage", value: certification, change: setCertification }] as const).map(field => <div key={field.key} className="space-y-2"><Label htmlFor={`team-deadline-${field.key}`}>{field.title}</Label><select id={`team-deadline-${field.key}`} className="h-11 w-full rounded-md border bg-background px-3 text-sm" disabled={!canManage || update.isPending} value={field.value} onChange={event => field.change(event.target.value)}><option value="">Select a stage</option>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.number}. {stage.name}{stage.isActive ? "" : " (inactive)"}</option>)}</select></div>)}</div><dl className="grid gap-4 text-sm lg:grid-cols-2"><div><dt className="text-muted-foreground">Joining/registration cutoff</dt><dd>{utc(selectedJoin?.deadline)}</dd></div><div><dt className="text-muted-foreground">Learning certification cutoff</dt><dd>{utc(selectedCertificate?.deadline)}</dd></div></dl>{(!selectedJoin || !selectedCertificate) && <p className="text-sm text-amber-600">Configure both stages before participants need these checks. Missing stages block the corresponding action.</p>}{wrongOrder && <p role="alert" className="text-sm text-destructive">The learning-certification deadline must be on or after the joining deadline.</p>}{canManage && <Button variant="outline" disabled={!changed || wrongOrder || update.isPending} onClick={save}>{update.isPending ? "Saving…" : "Save deadline stages"}</Button>}</section>;
}
