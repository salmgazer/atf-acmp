"use client";

import { useState } from "react";
import { Calendar, CalendarPlus, Download, Loader2, Pencil, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBriefEventCalendar, hostBriefEvent, useBriefEvents, useCancelBriefEvent, useSaveBriefEvent, type BriefEvent } from "@/lib/api/hooks/use-brief-events";

function localInputDate(value: Date): string {
  const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

export function BriefEvents({ briefId }: { briefId: string }) {
  const { data, isLoading, isError } = useBriefEvents(briefId);
  const save = useSaveBriefEvent(briefId);
  const cancel = useCancelBriefEvent(briefId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BriefEvent | null>(null);
  const [cancelling, setCancelling] = useState<BriefEvent | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function showEditor(event?: BriefEvent) {
    setEditing(event || null);
    setTitle(event?.title || "");
    setDescription(event?.description || "");
    setStartAt(event ? localInputDate(new Date(event.startAt)) : "");
    setDurationMinutes(event?.durationMinutes || 60);
    setOpen(true);
  }

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading brief events…</div>;
  if (isError) return <p className="text-sm text-destructive">Unable to load brief events. Please refresh the page.</p>;
  if (!data || (!data.canManage && !data.events?.length)) return null;

  const events = [...data.events].sort((a, b) => {
    const upcomingA = a.status === "scheduled" && new Date(a.endAt).getTime() > Date.now();
    const upcomingB = b.status === "scheduled" && new Date(b.endAt).getTime() > Date.now();
    if (upcomingA !== upcomingB) return upcomingA ? -1 : 1;
    return upcomingA ? Date.parse(a.startAt) - Date.parse(b.startAt) : Date.parse(b.startAt) - Date.parse(a.startAt);
  });

  return (
    <section id="events" aria-labelledby={`brief-events-${briefId}`} className="scroll-mt-6 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`brief-events-${briefId}`} className="flex items-center gap-2 text-lg font-semibold"><Calendar className="h-5 w-5" />Brief events</h2>
        {data.canManage && <Button size="sm" disabled={!data.zoomConfigured} onClick={() => showEditor()}><CalendarPlus className="mr-2 h-4 w-4" />Schedule event</Button>}
      </div>
      {data.host && <p className="mt-2 text-sm text-muted-foreground">Event host: {data.host.name}{data.host.source === "partner" ? " (partner main contact)" : " (brief main contact)"}</p>}
      {data.canManage && <p className="mt-2 text-sm text-muted-foreground">Confirmed participants in every team assigned to this brief receive calendar invitations, email, and push notifications. Teams assigned later are invited automatically.</p>}
      {data.canManage && !data.zoomConfigured && <p className="mt-3 rounded-md bg-muted p-3 text-sm">Event scheduling will be available once staff connects the shared ATF Zoom account.</p>}
      <div className="mt-4 space-y-4">
        {!events.length && <p className="text-sm text-muted-foreground">No events scheduled for this brief.</p>}
        {events.map(event => {
          const upcoming = event.status === "scheduled" && new Date(event.endAt).getTime() > Date.now();
          return (
            <article key={event.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{event.title}</h3><Badge variant={event.status === "cancelled" ? "secondary" : "outline"}>{event.status === "cancelled" ? "Cancelled" : upcoming ? "Scheduled" : "Past event"}</Badge></div>
              <p className="mt-2 text-sm">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone }).format(new Date(event.startAt))} ({event.timezone}) · {event.durationMinutes} minutes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>
              {data.canManage && <p className="mt-3 text-xs text-muted-foreground">{event.attendeeCount || 0} invited participants{event.deliveryPending ? " · Invitations or meeting updates are pending; ACMP will retry automatically." : ""}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {upcoming && event.zoomJoinUrl && <Button asChild size="sm"><a href={event.zoomJoinUrl} target="_blank" rel="noopener noreferrer"><Video className="mr-2 h-4 w-4" />Join Zoom</a></Button>}
                <Button variant="outline" size="sm" onClick={() => downloadBriefEventCalendar(event.id).catch(() => toast.error("Could not download the calendar invitation"))}><Download className="mr-2 h-4 w-4" />Add to calendar</Button>
                {data.canHost && upcoming && <Button size="sm" variant="outline" onClick={() => hostBriefEvent(event.id)}><Video className="mr-2 h-4 w-4" />Host event</Button>}
                {data.canManage && upcoming && <>
                  <Button size="sm" variant="outline" onClick={() => showEditor(event)}><Pencil className="mr-2 h-4 w-4" />Edit event</Button>
                  <Button size="sm" variant="outline" onClick={() => setCancelling(event)}>Cancel event</Button>
                </>}
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit brief event" : "Schedule brief event"}</DialogTitle><DialogDescription>A Zoom meeting will be created in the ATF account. Assigned teams receive invitations automatically.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={async event => {
            event.preventDefault();
            const start = new Date(startAt);
            if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) { toast.error("Choose a future date and time"); return; }
            try {
              await save.mutateAsync({ id: editing?.id, input: { title: title.trim(), description: description.trim(), startAt: start.toISOString(), timezone, durationMinutes } });
              setOpen(false);
            } catch { /* The mutation displays the error. */ }
          }}>
            <div className="space-y-2"><Label htmlFor={`event-title-${briefId}`}>Event title</Label><Input id={`event-title-${briefId}`} required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`event-agenda-${briefId}`}>What would you like to discuss?</Label><Textarea id={`event-agenda-${briefId}`} required maxLength={1900} rows={4} value={description} onChange={event => setDescription(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`event-date-${briefId}`}>Date and time ({timezone})</Label><Input id={`event-date-${briefId}`} type="datetime-local" required min={localInputDate(new Date())} value={startAt} onChange={event => setStartAt(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`event-duration-${briefId}`}>Duration in minutes</Label><Input id={`event-duration-${briefId}`} type="number" required min={15} max={480} value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button><Button type="submit" disabled={save.isPending || !title.trim() || !description.trim()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Schedule event"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cancelling} onOpenChange={open => { if (!open) setCancelling(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Cancel this event?</DialogTitle><DialogDescription>The Zoom meeting will be cancelled and invited participants will receive cancellation notices.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setCancelling(null)}>Keep event</Button><Button variant="destructive" disabled={cancel.isPending} onClick={async () => {
            if (!cancelling) return;
            try { await cancel.mutateAsync(cancelling.id); setCancelling(null); } catch { /* The mutation displays the error. */ }
          }}>Cancel event</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
