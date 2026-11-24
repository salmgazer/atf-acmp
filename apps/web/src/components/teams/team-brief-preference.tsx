"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TeamBriefPreference } from "@acmp/shared";
import { type Team, useUpdateTeamBriefPreference } from "@/lib/api/hooks/use-teams";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function TeamBriefPreferenceControl({ team, isLead }: { team: Team; isLead: boolean }) {
  const current = team.briefPreference || TeamBriefPreference.PARTNER;
  const [choice, setChoice] = useState(current), [error, setError] = useState("");
  const update = useUpdateTeamBriefPreference();
  useEffect(() => { setChoice(current); }, [current]);
  const canEdit = isLead && !team.briefId && team.status !== "disqualified";
  async function save() {
    setError("");
    try { await update.mutateAsync({ id: team.id, briefPreference: choice }); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save the brief preference. Please retry."); }
  }
  return <section className="space-y-3 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">Team brief plan</h2>
    <Link href="/participant/submissions" className="text-sm underline">View your team’s six steps</Link>
    {canEdit ? <><Label htmlFor="team-brief-preference">How will your team get its brief?</Label>
      <select id="team-brief-preference" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={choice} onChange={event => setChoice(event.target.value as TeamBriefPreference)} disabled={update.isPending}>
        <option value={TeamBriefPreference.PARTNER}>Receive a partner brief</option><option value={TeamBriefPreference.OWN}>Create our own brief</option>
      </select>
      <p className="text-sm text-muted-foreground">{choice === TeamBriefPreference.OWN ? "Your team will be excluded from partner brief assignment. Save your preference, then submit your problem brief for ATF review from the six steps page." : "Staff can assign your team an approved partner brief in a separate assignment run."}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={update.isPending || choice === current}>{update.isPending ? "Saving…" : "Save brief preference"}</Button>
    </> : <p className="text-sm text-muted-foreground">{current === TeamBriefPreference.OWN ? "This team plans to create its own brief and is excluded from partner brief assignment." : "This team receives a partner brief."} {team.briefId ? "Contact staff to unassign the current brief before switching to your own brief." : "Only the team lead can change this preference."}</p>}
  </section>;
}
