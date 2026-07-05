import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { readMetadata, writeMetadata } from "@/lib/blob";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["keep", "unkeep"]),
  blobUrl: z.string().url(),
});

export async function PATCH(req: NextRequest) {
  let email: string;
  try {
    email = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const m = await readMetadata();
  const g = m.gallery.find((x) => x.blobUrl === parsed.data.blobUrl);
  if (!g) return NextResponse.json({ error: "not-found" }, { status: 404 });

  if (parsed.data.action === "keep") {
    if (!g.keptBy.includes(email)) g.keptBy.push(email);
    const msg = m.chat.find((x) => x.id === g.sourceMsgId);
    if (msg && !msg.keptBy.includes(email)) msg.keptBy.push(email);
  } else {
    g.keptBy = g.keptBy.filter((e) => e !== email);
    const msg = m.chat.find((x) => x.id === g.sourceMsgId);
    if (msg) msg.keptBy = msg.keptBy.filter((e) => e !== email);
  }
  m.lastWriter = email;
  m.lastWriteAt = new Date().toISOString();
  await writeMetadata(m);
  return NextResponse.json({ ok: true });
}
