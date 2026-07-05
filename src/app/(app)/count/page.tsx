"use client";

import { useState } from "react";
import { useStatePoll } from "@/lib/use-state-poll";
import { displayName } from "@/lib/env";

type Delta = 1 | 2 | 5 | -1 | -2 | -5;

export default function CountPage() {
  const { data, loading, refresh } = useStatePoll(4000);
  const [delta, setDelta] = useState<Delta>(1);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);

  async function bump(sign: 1 | -1) {
    if (busy) return;
    setBusy(true);
    setPulse(true);
    setTimeout(() => setPulse(false), 300);
    try {
      const res = await fetch("/api/count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta: (sign * delta) as Delta }),
      });
      if (!res.ok) throw new Error(`count ${res.status}`);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const value = data?.count.value ?? 0;
  const by = data?.count.lastChangeBy ?? null;
  const at = data?.count.lastChangeAt ?? null;

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-8">
      <button
        onClick={() => bump(1)}
        onContextMenu={(e) => {
          e.preventDefault();
          void bump(-1);
        }}
        disabled={busy || loading}
        className={
          "relative w-64 h-64 rounded-full flex items-center justify-center transition-transform " +
          "bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 shadow-xl " +
          (pulse ? "scale-95" : "scale-100") +
          " active:scale-95 disabled:opacity-70"
        }
        aria-label={`Add ${delta} to count`}
      >
        <span className="text-7xl font-light tabular-nums">{value}</span>
      </button>

      <div className="flex items-center gap-2">
        {[1, 2, 5].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDelta(d as Delta)}
            className={
              "px-4 py-2 rounded-full text-sm border transition-colors " +
              (delta === d
                ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-neutral-100")
            }
          >
            +{d}
          </button>
        ))}
      </div>

      <div className="text-xs text-neutral-500 text-center space-y-1">
        <p>Tap the circle to add. Long-press or right-click to subtract.</p>
        {by && at ? (
          <p>
            Last changed by <span className="text-neutral-300">{displayName(by)}</span>{" "}
            <span>· {new Date(at).toLocaleString()}</span>
          </p>
        ) : (
          <p>No changes yet.</p>
        )}
      </div>
    </div>
  );
}
