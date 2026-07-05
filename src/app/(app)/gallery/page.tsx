"use client";

import { useState } from "react";
import { useStatePoll } from "@/lib/use-state-poll";
import { initial } from "@/lib/env";
import {
  formatCountdown,
  isVisibleInGallery,
  msUntilExpiry,
  shouldShowCountdown,
  type GalleryEntry,
} from "@/lib/metadata";

export default function GalleryPage() {
  const { data, refresh } = useStatePoll(6000);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [me, setMe] = useState<string | null>(null);

  // whoami
  if (me === null && typeof window !== "undefined") {
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMe(j.email));
  }

  const now = new Date();
  const visible = (data?.gallery ?? [])
    .filter((g) => isVisibleInGallery(g, now))
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

  async function keep(entry: GalleryEntry, keep: boolean) {
    await fetch("/api/gallery", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: keep ? "keep" : "unkeep", blobUrl: entry.blobUrl }),
    });
    await refresh();
  }

  return (
    <div className="p-2">
      {visible.length === 0 ? (
        <div className="text-center text-neutral-500 text-sm mt-16">
          <p>No photos in the current window.</p>
          <p className="mt-2 text-xs">
            Chat photos linger for 7 days. Snaps fade after 24 hours. Long-press any photo to keep it forever.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {visible.map((g, i) => (
            <Cell
              key={g.blobUrl}
              g={g}
              me={me}
              onOpen={() => setOpenIdx(i)}
              onKeep={(k) => keep(g, k)}
            />
          ))}
        </div>
      )}

      {openIdx !== null && visible[openIdx] && (
        <Viewer
          entries={visible}
          startIdx={openIdx}
          me={me}
          onClose={() => setOpenIdx(null)}
          onKeep={keep}
        />
      )}
    </div>
  );
}

function Cell({
  g,
  me,
  onOpen,
  onKeep,
}: {
  g: GalleryEntry;
  me: string | null;
  onOpen: () => void;
  onKeep: (k: boolean) => void;
}) {
  const countdown = shouldShowCountdown(g);
  const ms = msUntilExpiry(g);
  const kept = me ? g.keptBy.includes(me) : false;
  const [pressed, setPressed] = useState(false);

  const start = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 700);
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onKeep(!kept);
      }}
      onTouchStart={start}
      className="relative aspect-square overflow-hidden rounded-sm bg-neutral-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={g.blobUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      <span className="absolute top-1 left-1 text-[10px] px-1 rounded bg-black/60 text-white">
        {initial(g.sender)}
      </span>
      {g.sourceType === "snap" && (
        <span className="absolute top-1 right-1 text-[10px] px-1 rounded bg-purple-600/80 text-white">
          snap
        </span>
      )}
      {kept && <span className="absolute bottom-1 right-1 text-amber-400 text-sm">★</span>}
      {countdown && ms !== null && (
        <span className="absolute bottom-1 left-1 text-[10px] px-1 rounded bg-red-600/80 text-white">
          {formatCountdown(ms)}
        </span>
      )}
    </button>
  );
}

function Viewer({
  entries,
  startIdx,
  me,
  onClose,
  onKeep,
}: {
  entries: GalleryEntry[];
  startIdx: number;
  me: string | null;
  onClose: () => void;
  onKeep: (g: GalleryEntry, k: boolean) => void;
}) {
  const [i, setI] = useState(startIdx);
  const g = entries[i];
  if (!g) return null;
  const kept = me ? g.keptBy.includes(me) : false;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 text-white">
        <button onClick={onClose} className="text-sm">✕ Close</button>
        <span className="text-xs text-neutral-400">
          {i + 1} / {entries.length}
        </span>
        <button
          onClick={() => onKeep(g, !kept)}
          className={"text-sm " + (kept ? "text-amber-400" : "text-neutral-400")}
        >
          {kept ? "★ Kept" : "☆ Keep"}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.blobUrl} alt="" className="max-h-full max-w-full" />
      </div>
      <div className="flex justify-between px-6 py-4 text-neutral-500 text-sm">
        <button disabled={i === 0} onClick={() => setI(i - 1)} className="disabled:opacity-30">
          ← Prev
        </button>
        <span>
          {initial(g.sender)} · {new Date(g.capturedAt).toLocaleString()}
        </span>
        <button
          disabled={i === entries.length - 1}
          onClick={() => setI(i + 1)}
          className="disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
