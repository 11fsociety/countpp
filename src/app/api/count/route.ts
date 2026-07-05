import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { readMetadata, writeMetadata } from "@/lib/blob";
import { targetSideFor } from "@/lib/metadata";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  delta: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(5),
    z.literal(-1),
    z.literal(-5),
  ]),
});

/**
 * POST /api/count — bump the OTHER user's count by `delta`.
 *
 * Asmit's tap affects Vidhi's count. Vidhi's tap affects Asmit's count.
 * Neither user can change their own count directly.
 */
export async function POST(req: NextRequest) {
  let email: string;
  try {
    email = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const m = await readMetadata();
  const target = targetSideFor(email);
  const now = new Date().toISOString();
  m.count[target].value = m.count[target].value + parsed.data.delta;
  m.count[target].lastChangeBy = email;
  m.count[target].lastChangeAt = now;
  m.lastWriter = email;
  m.lastWriteAt = now;
  await writeMetadata(m);
  return NextResponse.json({ count: m.count });
}

/**
 * DELETE /api/count — reset the OTHER user's count to 0.
 *
 * Asmit's reset zeroes Vidhi's count. Vidhi's reset zeroes Asmit's count.
 */
export async function DELETE() {
  let email: string;
  try {
    email = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const m = await readMetadata();
  const target = targetSideFor(email);
  const now = new Date().toISOString();
  m.count[target].value = 0;
  m.count[target].lastChangeBy = email;
  m.count[target].lastChangeAt = now;
  m.lastWriter = email;
  m.lastWriteAt = now;
  await writeMetadata(m);
  return NextResponse.json({ count: m.count });
}
