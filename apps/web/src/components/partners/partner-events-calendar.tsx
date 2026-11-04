"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBriefEventCalendar, usePartnerEventCalendar } from "@/lib/api/hooks/use-brief-events";

export function PartnerEventsCalendar({ cohortId }: { cohortId?: string }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("");
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  useEffect(() => { setSelectedId(null); }, [cohortId, month, search]);

  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }), [month]);
  const { data, isLoading, isError, refetch } = usePartnerEventCalendar({
    cohortId, startAt: days[0].toISOString(), endAt: addDays(days[days.length - 1], 1).toISOString(), search: search || undefined,
  });
  const events = data?.events || [];
  const selected = events.find(event => event.id === selectedId);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));

  const download = async () => {
    if (!selected) return;
    setDownloading(true);
    try { await downloadBriefEventCalendar(selected.id); }
    catch { toast.error("Could not download the calendar invitation"); }
    finally { setDownloading(false); }
  };

  return (
    <section aria-label="Partner brief event calendar" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Brief events</h2>
          <p className="text-sm text-muted-foreground">All partner brief events in the selected cohort. Times shown in {timezone || "your local timezone"}.</p>
        </div>
        <input aria-label="Filter events by partner" placeholder="Search partners in calendar..." value={search} onChange={event => setSearch(event.target.value)}
          className="h-10 rounded-full border border-border bg-transparent px-4 text-sm placeholder:text-muted-foreground" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="text-lg font-semibold" aria-live="polite">{format(month, "MMMM yyyy")}</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(value => subMonths(value, 1))}><ChevronLeft className="h-5 w-5" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(value => addMonths(value, 1))}><ChevronRight className="h-5 w-5" /></Button>
          </div>
        </div>
        {!cohortId ? <p className="p-8 text-center text-muted-foreground">Select a cohort to view partner events.</p>
          : isLoading ? <div role="status" className="flex justify-center gap-2 p-12"><Loader2 className="h-5 w-5 animate-spin" />Loading events…</div>
          : isError ? <div role="alert" className="space-y-3 p-8 text-center"><p>Could not load partner events.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
          : <>
            {!events.length && <p role="status" className="border-b border-border p-4 text-sm text-muted-foreground">{search ? "No partner events match this search in the displayed dates." : "No partner events scheduled in the displayed dates."}</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] table-fixed" aria-label="Partner events by day">
                <thead className="bg-muted"><tr>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <th key={day} scope="col" className="p-2 text-center text-xs font-medium text-muted-foreground">{day}</th>)}</tr></thead>
                <tbody>{weeks.map(week => <tr key={week[0].toISOString()}>{week.map(day => {
                  const dayEvents = events.filter(event => parseISO(event.startAt) < addDays(day, 1) && parseISO(event.endAt) > day);
                  return <td key={day.toISOString()} aria-label={format(day, "EEEE, MMMM d, yyyy")} className={`h-32 border border-border/50 p-1.5 align-top ${isSameMonth(day, month) ? "" : "bg-muted/40 text-muted-foreground"}`}>
                    <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(day) ? "bg-primary font-semibold text-primary-foreground" : ""}`}>{format(day, "d")}</span>
                    <div className="space-y-1">{dayEvents.map(event => <button key={event.id} onClick={() => setSelectedId(event.id)}
                      className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted ${event.status === "cancelled" ? "border-border bg-muted text-muted-foreground" : "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"}`}>
                      <span className={`block font-medium ${event.status === "cancelled" ? "line-through" : ""}`}>{parseISO(event.startAt) < day ? "Continues" : format(parseISO(event.startAt), "h:mm a")} · {event.title}</span>
                      <span className="block truncate">{event.organization.name}</span><span className="block truncate">{event.brief.title}</span>
                      {event.status === "cancelled" && <span className="block">Cancelled</span>}
                    </button>)}</div>
                  </td>;
                })}</tr>)}</tbody>
              </table>
            </div>
          </>}
      </div>
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Partner brief event details</DialogDescription></DialogHeader>
          {selected && <div className="space-y-4">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${selected.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-blue-500/10 text-blue-700 dark:text-blue-300"}`}>{selected.status === "cancelled" ? "Cancelled" : "Scheduled"}</span>
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-muted-foreground">Partner</dt><dd><Link className="font-medium hover:underline" href={`/staff/partners/${selected.organization.id}`}>{selected.organization.name}</Link></dd></div>
              <div><dt className="text-muted-foreground">Brief</dt><dd><Link className="font-medium hover:underline" href={`/staff/briefs/${selected.brief.id}`}>{selected.brief.title}</Link></dd></div>
              <div><dt className="text-muted-foreground">Date and time ({timezone})</dt><dd>{format(parseISO(selected.startAt), "EEEE, MMMM d, yyyy 'at' h:mm a")} – {format(parseISO(selected.endAt), "MMM d, h:mm a")} · {selected.durationMinutes} minutes</dd></div>
              <div><dt className="text-muted-foreground">Event timezone</dt><dd>{new Intl.DateTimeFormat("en", { timeZone: selected.timezone, dateStyle: "medium", timeStyle: "short" }).format(parseISO(selected.startAt))} ({selected.timezone})</dd></div>
              <div><dt className="text-muted-foreground">Discussion agenda</dt><dd className="whitespace-pre-wrap break-words">{selected.description}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {selected.status === "scheduled" && selected.zoomJoinUrl && <Button asChild><a href={selected.zoomJoinUrl} target="_blank" rel="noopener noreferrer"><Video className="mr-2 h-4 w-4" />Join Zoom<ExternalLink className="ml-2 h-3 w-3" /></a></Button>}
              <Button variant="outline" disabled={downloading} onClick={download}>{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Add to calendar</Button>
              <Button variant="outline" asChild><Link href={`/staff/briefs/${selected.brief.id}`}><Calendar className="mr-2 h-4 w-4" />View brief</Link></Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
