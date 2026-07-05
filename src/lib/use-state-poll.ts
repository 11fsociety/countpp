"use client";

import { useEffect, useRef, useState } from "react";
import type { Metadata } from "./metadata";

/**
 * Poll /api/state every `intervalMs` (default 4s). Returns the latest
 * metadata + a helpers object.
 *
 * Behavior:
 *  - On first mount: fetch immediately.
 *  - Then every intervalMs.
 *  - When the tab is hidden, pause polling. Resume + immediate re-fetch on focus.
 *  - `refresh()` triggers an immediate fetch (e.g. after a mutation).
 */
export function useStatePoll(intervalMs = 4000) {
  const [data, setData] = useState<Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);
  const mounted = useRef(true);

  const fetchNow = useRef(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`state ${res.status}`);
      const json = (await res.json()) as Metadata;
      if (mounted.current) {
        setData(json);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  });

  useEffect(() => {
    mounted.current = true;
    const tick = () => {
      if (document.visibilityState === "visible") void fetchNow.current();
    };
    void fetchNow.current();
    timer.current = window.setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchNow.current();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mounted.current = false;
      if (timer.current !== null) window.clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return { data, loading, error, refresh: () => fetchNow.current() };
}
