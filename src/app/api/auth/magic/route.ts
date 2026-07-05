import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { verifyMagicLink } from "@/lib/magic";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  const check = verifyMagicLink(email, exp, sig);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 401 });
  }
  const allowed = env().server.ALLOWED_EMAILS;
  if (!allowed.includes(check.email)) {
    return NextResponse.json({ error: "not-whitelisted" }, { status: 403 });
  }

  const session = await getSession();
  session.email = check.email;
  session.loggedInAt = new Date().toISOString();
  await session.save();

  return NextResponse.redirect(new URL("/count", req.url));
}
