"use client";

import { useEffect, useState } from "react";
import { useStatePoll } from "@/lib/use-state-poll";
import { displayName } from "@/lib/env";

type Delta = 1 | 2 | 5 | -1 | -5;

export default function CountPage() {
  const { data, loading, refresh } = useStatePoll(4000);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMe(j.email));
  }, []);

  async function bump(delta: Delta) {
    if (busy) return;
    setBusy(true);
    setPulse(true);
    setTimeout(() => setPulse(false), 300);
    try {
      const res = await fetch("/api/count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) throw new Error(`count ${res.status}`);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/count", { method: "DELETE" });
      if (!res.ok) throw new Error(`reset ${res.status}`);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  const asmit = data?.count.asmit;
  const vidhi = data?.count.vidhi;
  const meIsAsmit = me?.toLowerCase() === "asmitdash44@gmail.com";
  const meIsVidhi = me?.toLowerCase() === "bhanushalividhi2@gmail.com";

  // "Their" count is the one the current user's actions affect.
  const theirLabel = meIsAsmit ? "Vidhi" : meIsVidhi ? "Asmit" : "?";
  const myLabel = meIsAsmit ? "Asmit" : meIsVidhi ? "Vidhi" : "?";
  const theirCount = meIsAsmit ? vidhi : meIsVidhi ? asmit : null;
  const myCount = meIsAsmit ? asmit : meIsVidhi ? vidhi : null;

  return (
    <div className="min-h-full flex flex-col p-4 gap-6">
      <header className="text-center">
        <h1 className="text-lg font-medium text-neutral-300">
          {loading ? "..." : `Every tap bumps ${theirLabel}'s count.`}
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          {theirLabel} does the same to yours.
        </p>
      </header>

      {/* Two count tiles */}
      <div className="grid grid-cols-2 gap-3">
        <CountTile
          name={myLabel}
          highlight={false}
          side={myCount}
        />
        <CountTile
          name={theirLabel}
          highlight
          side={theirCount}
        />
      </div>

      {/* Circular action button — bumps THEIR count by the currently-selected magnitude */}
      <div className="flex flex-col items-center gap-4 mt-4">
        <button
          onClick={() => bump(1)}
          disabled={busy || loading || !me}
          className={
            "w-56 h-56 rounded-full flex flex-col items-center justify-center transition-transform " +
            "bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 shadow-xl " +
            (pulse ? "scale-95" : "scale-100") +
            " active:scale-95 disabled:opacity-70"
          }
          aria-label={`Add 1 to ${theirLabel}'s count`}
        >
          <span className="text-6xl font-light tabular-nums">+1</span>
          <span className="text-xs text-neutral-500 mt-1">for {theirLabel}</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <ChipButton label="+2" onClick={() => bump(2)} disabled={busy} />
          <ChipButton label="+5" onClick={() => bump(5)} disabled={busy} />
          <ChipButton label="-1" tone="danger" onClick={() => bump(-1)} disabled={busy} />
          <ChipButton label="-5" tone="danger" onClick={() => bump(-5)} disabled={busy} />
        </div>

        {/* Reset row */}
        <div className="mt-2">
          {confirmReset ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-400">Reset {theirLabel}'s count to 0?</span>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="px-3 py-1 rounded-full bg-red-600 text-white disabled:opacity-50"
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1 rounded-full text-neutral-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={busy}
              className="text-xs text-neutral-500 hover:text-neutral-300 underline"
            >
              Reset {theirLabel}'s count
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CountTile({
  name,
  highlight,
  side,
}: {
  name: string;
  highlight: boolean;
  side: { value: number; lastChangeBy: string | null; lastChangeAt: string | null } | null | undefined;
}) {
  return (
    <div
      className={
        "rounded-2xl p-4 border " +
        (highlight
          ? "bg-neutral-900 border-neutral-700"
          : "bg-neutral-950 border-neutral-900")
      }
    >
      <div className="text-xs text-neutral-500">{name}</div>
      <div className="text-5xl font-light tabular-nums mt-1">
        {side?.value ?? 0}
      </div>
      {side?.lastChangeBy && side?.lastChangeAt ? (
        <div className="text-[10px] text-neutral-600 mt-2">
          last touched by {displayName(side.lastChangeBy)}
        </div>
      ) : (
        <div className="text-[10px] text-neutral-600 mt-2">no changes yet</div>
      )}
    </div>
  );
}

function ChipButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "px-4 py-2 rounded-full text-sm border transition-colors disabled:opacity-50 " +
        (tone === "danger"
          ? "bg-red-900/30 text-red-200 border-red-900/60 hover:text-red-100"
          : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-neutral-100")
      }
    >
      {label}
    </button>
  );
}
