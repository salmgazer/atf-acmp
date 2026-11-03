"use client";

export function GroupFilter({ groups, value, onChange }: { groups: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-muted-foreground">Group:</span>
      <select aria-label="Filter by group" value={value} onChange={event => onChange(event.target.value)} className="h-9 rounded-lg border border-border bg-card px-3 text-sm">
        <option value="all">All groups</option>
        <option value="ungrouped">Not assigned</option>
        {groups.map(group => <option key={group} value={`group:${group}`}>{group}</option>)}
      </select>
    </label>
  );
}
