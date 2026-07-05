import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { readMetadata, writeMetadata } from "@/lib/blob";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  delta: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(-1), z.literal(-2), z.literal(-5)]),
});

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
  m.count.value = m.count.value + parsed.data.delta;
  m.count.lastChangeBy = email;
  m.count.lastChangeAt = new Date().toISOString();
  m.lastWriter = email;
  m.lastWriteAt = new Date().toISOString();
  await writeMetadata(m);
  return NextResponse.json({ count: m.count });
}
