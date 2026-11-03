"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCreateTeam, useSearchAvailableParticipants } from "@/lib/api/hooks/use-teams";

export function CreateTeamDialog({ cohortId, groups }: { cohortId?: string; groups: string[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [leadId, setLeadId] = useState("");
  const router = useRouter();
  const create = useCreateTeam();
  const { data: participants = [] } = useSearchAvailableParticipants(open ? cohortId || "" : "", search);
  const leads = participants.filter(p => !groups.length || (p.group && groups.includes(p.group)));
  const lead = leads.find(p => p.id === leadId);
  return <>
    <button disabled={!cohortId} onClick={() => { setName(""); setSearch(""); setLeadId(""); setOpen(true); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Create team</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Create team</DialogTitle>
        <DialogDescription>Select a team lead. The team inherits their group, and every member must share it.</DialogDescription>
        <form className="space-y-4" onSubmit={async event => {
          event.preventDefault();
          if (!cohortId || !lead || !name.trim()) return;
          try {
            const team = await create.mutateAsync({ name: name.trim(), cohortId, creatorId: lead.id });
            setOpen(false);
            router.push(`/staff/teams/${team.id}`);
          } catch { /* The mutation displays the API error. */ }
        }}>
          <label className="block text-sm">Team name<input required maxLength={255} value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="block text-sm">Find a team lead<input value={search} onChange={event => { setSearch(event.target.value); setLeadId(""); }} className="mt-1 w-full rounded border bg-background p-2" placeholder="Search by name or email" /></label>
          <label className="block text-sm">Team lead<select aria-label="Team lead" required value={leadId} onChange={event => setLeadId(event.target.value)} className="mt-1 w-full rounded border bg-background p-2">
            <option value="" disabled>Select a participant</option>
            {leads.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.email}{p.group ? ` (${p.group})` : ""}</option>)}
          </select></label>
          <p className="text-sm text-muted-foreground">Group: {lead?.group || (groups.length ? "Select a lead with an assigned group" : "No groups configured")}</p>
          <button disabled={!lead || !name.trim() || create.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{create.isPending ? "Creating…" : "Create team"}</button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
