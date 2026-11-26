"use client";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/lib/api/hooks/use-notifications";
import { toast } from "sonner";

export function ChatEmailPreferences({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const preferences = useNotificationPreferences(), update = useUpdateNotificationPreferences();
  const [email, setEmail] = useState(true), [chat, setChat] = useState(true);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState("");
  useEffect(() => { if (initiallyOpen) setOpen(true); }, [initiallyOpen]);
  useEffect(() => {
    if (!open || !preferences.data) return;
    setEmail(preferences.data.emailEnabled !== false); setChat(preferences.data.typeSettings?.chat_message?.email !== false);
    setStart(preferences.data.quietHoursStart || ""); setEnd(preferences.data.quietHoursEnd || ""); setTimezone(preferences.data.timezone || "UTC"); setError("");
  }, [open, preferences.data]);
  async function save() {
    setError("");
    if (!!start !== !!end || start && start === end) { setError("Set both quiet-hour times, with different start and end times, or leave both blank."); return; }
    try { new Intl.DateTimeFormat("en", { timeZone: timezone }); }
    catch { setError("Enter a valid timezone, such as Africa/Accra or UTC."); return; }
    try {
      await update.mutateAsync({ emailEnabled: email, typeSettings: { ...preferences.data?.typeSettings, chat_message: { ...preferences.data?.typeSettings?.chat_message, email: chat } }, quietHoursStart: start, quietHoursEnd: end, timezone });
      setOpen(false); toast.success("Email preferences saved");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save preferences"); }
  }
  return <><Button variant="ghost" size="icon" aria-label="Chat email notifications" title="Chat email notifications" onClick={() => setOpen(true)}><Mail className="h-4 w-4" /></Button>
    <Dialog open={open} onOpenChange={value => { if (!update.isPending) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Chat email notifications</DialogTitle><DialogDescription>Unread team messages are grouped after five minutes. You’ll receive at most one reminder per hour, and none if you’ve read the messages.</DialogDescription></DialogHeader>
      {preferences.isPending ? <p>Loading email settings…</p> : preferences.isError ? <div role="alert"><p>Could not load your email preferences.</p><Button variant="outline" className="mt-2" onClick={() => preferences.refetch()}>Retry</Button></div> : <fieldset disabled={update.isPending} className="space-y-4">
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={email} onCheckedChange={value => setEmail(value === true)} /><span>Allow email notifications for my account<span className="mt-1 block text-xs text-muted-foreground">This account setting also applies to other notification emails.</span></span></label>
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={chat} disabled={!email} onCheckedChange={value => setChat(value === true)} /><span>Email me about unread team chat<span className="mt-1 block text-xs text-muted-foreground">Team chat emails stop when this is off. Replies must be sent in the app.</span></span></label>
        <div><p className="mb-2 text-sm font-medium">Quiet hours (optional)</p><div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm">Start<input aria-label="Quiet hours start" className="h-10 w-full rounded-lg border bg-background px-3" type="time" value={start} onChange={event => setStart(event.target.value)} /></label><label className="space-y-1 text-sm">End<input aria-label="Quiet hours end" className="h-10 w-full rounded-lg border bg-background px-3" type="time" value={end} onChange={event => setEnd(event.target.value)} /></label></div><label className="mt-3 block space-y-1 text-sm">Timezone<input aria-label="Quiet hours timezone" className="h-10 w-full rounded-lg border bg-background px-3" value={timezone} maxLength={100} onChange={event => setTimezone(event.target.value)} placeholder="Africa/Accra" /></label><p className="mt-2 text-xs text-muted-foreground">Reminders wait until quiet hours end. These hours apply to your account’s notification settings.</p></div>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={update.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={preferences.isPending || preferences.isError || update.isPending} onClick={save}>{update.isPending ? "Saving…" : "Save preferences"}</Button></DialogFooter>
    </DialogContent></Dialog></>;
}
