import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ulid } from "ulid";
import { requireUser } from "@/lib/session";
import { readMetadata, writeMetadata } from "@/lib/blob";
import { purgeChat } from "@/lib/metadata";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  type: z.enum(["text", "photo", "snap"]),
  text: z.string().max(2000).optional(),
  blobUrl: z.string().url().optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("view"), id: z.string() }),
  z.object({ action: z.literal("keep"), id: z.string() }),
  z.object({ action: z.literal("unkeep"), id: z.string() }),
  z.object({ action: z.literal("delete"), id: z.string() }),
]);

/**
 * POST /api/chat — send a new message.
 * Body: { type: "text" | "photo" | "snap", text?: string, blobUrl?: string }
 */
export async function POST(req: NextRequest) {
  let email: string;
  try {
    email = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });
  const b = parsed.data;
  if (b.type === "text" && !b.text) return NextResponse.json({ error: "text-required" }, { status: 400 });
  if ((b.type === "photo" || b.type === "snap") && !b.blobUrl) {
    return NextResponse.json({ error: "blob-required" }, { status: 400 });
  }

  const m = await readMetadata();
  const now = new Date().toISOString();
  const id = `msg-${ulid()}`;
  m.chat.push({
    id,
    sender: email,
    createdAt: now,
    type: b.type,
    text: b.text,
    blobUrl: b.blobUrl,
    viewedAt: null,
    keptBy: [],
    deleted: false,
  });
  if (b.type === "photo" || b.type === "snap") {
    if (b.blobUrl) {
      m.gallery.push({
        blobUrl: b.blobUrl,
        sender: email,
        capturedAt: now,
        sourceMsgId: id,
        sourceType: b.type,
        keptBy: [],
      });
    }
  }
  m.lastWriter = email;
  m.lastWriteAt = now;
  m.chat = purgeChat(m.chat);
  await writeMetadata(m);
  return NextResponse.json({ id });
}

/**
 * PATCH /api/chat — mutate an existing message.
 * Body: { action: "view"|"keep"|"unkeep"|"delete", id: string }
 */
export async function PATCH(req: NextRequest) {
  let email: string;
  try {
    email = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const m = await readMetadata();
  const msg = m.chat.find((x) => x.id === parsed.data.id);
  if (!msg) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const action = parsed.data.action;
  if (action === "view") {
    // Only mark viewed if the viewer is NOT the sender (a sender can't
    // burn their own snap).
    if (msg.sender !== email && msg.viewedAt === null) {
      msg.viewedAt = new Date().toISOString();
    }
  } else if (action === "keep") {
    if (!msg.keptBy.includes(email)) msg.keptBy.push(email);
    // Also mirror keep onto the gallery entry if this is an image
    if (msg.type === "photo" || msg.type === "snap") {
      const g = m.gallery.find((x) => x.sourceMsgId === msg.id);
      if (g && !g.keptBy.includes(email)) g.keptBy.push(email);
    }
  } else if (action === "unkeep") {
    msg.keptBy = msg.keptBy.filter((e) => e !== email);
    if (msg.type === "photo" || msg.type === "snap") {
      const g = m.gallery.find((x) => x.sourceMsgId === msg.id);
      if (g) g.keptBy = g.keptBy.filter((e) => e !== email);
    }
  } else if (action === "delete") {
    // Only the sender can delete their own message.
    if (msg.sender === email) msg.deleted = true;
  }
  m.lastWriter = email;
  m.lastWriteAt = new Date().toISOString();
  m.chat = purgeChat(m.chat);
  await writeMetadata(m);
  return NextResponse.json({ ok: true });
}
