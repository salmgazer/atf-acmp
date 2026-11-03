"use client";

import { useAssignParticipantGroup, type Participant } from '@/lib/api/hooks/use-participants';

export function ParticipantGroupEditor({ participant, groups }: { participant: Participant; groups: string[] }) {
  const mutation = useAssignParticipantGroup();
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">Group</span>
      {groups.length ? <select aria-label="Participant group" value={participant.group || ''} disabled={mutation.isPending} onChange={event => { if (event.target.value) mutation.mutate({ id: participant.id, group: event.target.value }); }} className="h-9 w-full rounded-md border bg-background px-3">
        <option value="" disabled>Select a group</option>
        {groups.map(group => <option key={group} value={group}>{group}</option>)}
      </select> : <span className="block">{participant.group || 'No groups configured'}</span>}
    </label>
  );
}
