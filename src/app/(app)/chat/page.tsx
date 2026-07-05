"use client";

import { useRef, useState, useEffect } from "react";
import { useStatePoll } from "@/lib/use-state-poll";
import { displayName, initial } from "@/lib/env";
import { SNAP_VIEW_MS, type ChatMessage } from "@/lib/metadata";

interface MessageProps {
  msg: ChatMessage;
  me: string;
  onView(id: string): void;
  onKeep(id: string, keep: boolean): void;
  onDelete(id: string): void;
}

function Message({ msg, me, onView, onKeep, onDelete }: MessageProps) {
  const isMine = msg.sender.toLowerCase() === me.toLowerCase();
  const kept = msg.keptBy.includes(me);
  const [longPressed, setLongPressed] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const [snapOpen, setSnapOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // If this is a snap I received and haven't viewed, allow tap-to-open.
  const isUnviewedSnapForMe = msg.type === "snap" && !isMine && msg.viewedAt === null;

  useEffect(() => {
    if (!snapOpen) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const left = SNAP_VIEW_MS - elapsed;
      if (left <= 0) {
        setSnapOpen(false);
        onView(msg.id);
        return;
      }
      setRemaining(left);
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snapOpen, msg.id, onView]);

  const startPress = () => {
    pressTimer.current = window.setTimeout(() => setLongPressed(true), 550);
  };
  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  if (msg.deleted) {
    return <div className="text-xs text-neutral-600 italic px-3 py-1">Message deleted</div>;
  }

  // Snap: hide from chat once viewed.
  if (msg.type === "snap" && msg.viewedAt !== null) return null;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 py-1`}>
      <div className="max-w-[80%] flex flex-col gap-1">
        <button
          type="button"
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onClick={() => {
            if (isUnviewedSnapForMe) setSnapOpen(true);
          }}
          className={
            "rounded-2xl px-3 py-2 text-sm relative text-left break-words " +
            (isMine ? "bg-neutral-100 text-neutral-950" : "bg-neutral-800 text-neutral-100") +
            (kept ? " ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-950" : "")
          }
        >
          {msg.type === "text" && <span>{msg.text}</span>}
          {msg.type === "photo" && msg.blobUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.blobUrl} alt="" className="rounded-lg max-h-64" />
          )}
          {msg.type === "snap" &&
            (isMine ? (
              <span className="italic text-neutral-500">Snap sent · she has to open it</span>
            ) : (
              <span className="italic">Snap · tap to view</span>
            ))}
          {kept && <span className="absolute -top-2 -right-2 text-amber-400 text-xs">★</span>}
        </button>
        <div className={`text-[10px] text-neutral-500 flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
          <span>{displayName(msg.sender)}</span>
          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {longPressed && (
          <div className="flex gap-2 text-xs mt-1">
            <button
              type="button"
              onClick={() => {
                onKeep(msg.id, !kept);
                setLongPressed(false);
              }}
              className="px-2 py-1 rounded bg-neutral-800 text-neutral-100 border border-neutral-700"
            >
              {kept ? "Un-keep" : "Keep forever"}
            </button>
            {isMine && (
              <button
                type="button"
                onClick={() => {
                  onDelete(msg.id);
                  setLongPressed(false);
                }}
                className="px-2 py-1 rounded bg-red-900/40 text-red-200 border border-red-900/60"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setLongPressed(false)}
              className="px-2 py-1 rounded text-neutral-400"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Full-screen snap viewer */}
      {snapOpen && msg.blobUrl && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={msg.blobUrl} alt="" className="max-h-full max-w-full" />
          <div className="absolute top-4 left-4 right-4 flex justify-between text-white text-sm">
            <span>from {displayName(msg.sender)}</span>
            <span>{Math.ceil(remaining / 1000)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { data, refresh } = useStatePoll(3500);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const snapRef = useRef<HTMLInputElement | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Small helper to discover our own email — pulled from the /api/state's lastWriter isn't safe.
    // Instead call a lightweight introspection endpoint. We inline it as a fetch to /api/state and
    // read the session cookie server-side there. Cheaper: expose a tiny /api/whoami route.
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMe(j.email));
  }, []);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "text", text: text.trim() }),
      });
      if (res.ok) {
        setText("");
        await refresh();
      }
    } finally {
      setSending(false);
    }
  }

  async function sendPhoto(type: "photo" | "snap", file: File) {
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) return;
      const { url } = (await up.json()) as { url: string };
      await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, blobUrl: url }),
      });
      await refresh();
    } finally {
      setSending(false);
    }
  }

  async function markView(id: string) {
    await fetch("/api/chat", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "view", id }),
    });
    await refresh();
  }

  async function keep(id: string, keep: boolean) {
    await fetch("/api/chat", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: keep ? "keep" : "unkeep", id }),
    });
    await refresh();
  }

  async function del(id: string) {
    await fetch("/api/chat", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await refresh();
  }

  const messages = data?.chat ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 text-sm mt-10">No messages yet.</div>
        )}
        {me &&
          messages.map((m) => (
            <Message key={m.id} msg={m} me={me} onView={markView} onKeep={keep} onDelete={del} />
          ))}
      </div>
      <div className="p-2 border-t border-neutral-900 flex gap-2 items-center">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) void sendPhoto("photo", f);
          e.currentTarget.value = "";
        }} />
        <input ref={snapRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) void sendPhoto("snap", f);
          e.currentTarget.value = "";
        }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-lg text-neutral-400 px-2"
          aria-label="Send photo"
        >
          🖼️
        </button>
        <button
          type="button"
          onClick={() => snapRef.current?.click()}
          className="text-lg text-neutral-400 px-2"
          aria-label="Send snap"
        >
          📸
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Say something..."
          className="flex-1 rounded-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || sending}
          className="rounded-full bg-neutral-100 text-neutral-950 px-4 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
