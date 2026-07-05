import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { readMetadata } from "@/lib/blob";
import { purgeChat } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const m = await readMetadata();
  // Purge chat on read so the client never gets stale un-kept messages.
  m.chat = purgeChat(m.chat);
  return NextResponse.json(m);
}
