import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ email: s.email });
}
