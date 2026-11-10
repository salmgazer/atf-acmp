"use client";
import { useCallback, useEffect, useState } from "react";
import { rateLimitRetrySeconds } from "@/lib/api/rate-limit";

export function useRateLimitCooldown() {
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const capture = useCallback((error: unknown) => {
    const delay = rateLimitRetrySeconds(error);
    if (delay === null) return false;
    setSeconds(delay); setRetryAt(Date.now() + delay * 1000); return true;
  }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setSeconds(remaining); if (!remaining) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  return { seconds, capture };
}

export function RateLimitNotice({ seconds }: { seconds: number }) {
  return seconds > 0 ? <p role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm">Too many requests. Try again in {seconds} seconds. Your entries have been kept.</p> : null;
}
