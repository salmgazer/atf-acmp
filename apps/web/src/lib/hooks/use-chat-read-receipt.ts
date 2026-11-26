"use client";
import { useEffect, useRef } from "react";
import { useMarkAsRead } from "@/lib/api/hooks/use-chat";
import { useChatContext } from "@/lib/contexts/chat-context";

export const CHAT_IDLE_MS = 2 * 60_000;

/** A connection or an open background tab does not mean messages were seen. */
export function useChatReadReceipt(channelId: string, messageId: string | undefined, loaded: boolean, end: React.RefObject<HTMLDivElement | null>) {
  const { mutate } = useMarkAsRead();
  const { setActiveChannelId, refreshUnreadCount } = useChatContext();
  const interaction = useRef(Date.now());
  const acknowledged = useRef<string | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    let inView = false, disposed = false;
    const key = `${channelId}:${messageId}`;
    const sync = () => {
      const reading = loaded && !!messageId && inView && document.visibilityState === "visible" && document.hasFocus() && Date.now() - interaction.current < CHAT_IDLE_MS;
      setActiveChannelId(reading ? channelId : null);
      if (!reading || pending.current === key || acknowledged.current === key) return;
      pending.current = key;
      mutate({ channelId, messageId }, {
        onSuccess: () => { acknowledged.current = key; if (!disposed) refreshUnreadCount(); },
        onSettled: () => { if (pending.current === key) pending.current = null; },
      });
    };
    const activity = () => { interaction.current = Date.now(); sync(); };
    const visibility = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) interaction.current = Date.now();
      sync();
    };
    const observer = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting === true; sync(); }, { threshold: 0.5 });
    if (end.current && loaded) observer.observe(end.current);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", activity);
    window.addEventListener("blur", sync);
    for (const event of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) window.addEventListener(event, activity, { passive: true, capture: true });
    const timer = window.setInterval(sync, 15_000);
    return () => {
      disposed = true; observer.disconnect(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", activity); window.removeEventListener("blur", sync);
      for (const event of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) window.removeEventListener(event, activity, { capture: true });
      setActiveChannelId(null);
    };
  }, [channelId, messageId, loaded, end, mutate, setActiveChannelId, refreshUnreadCount]);
}
