import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { CountppSession } from "@/lib/session";

/**
 * Middleware guards all pages except /login and /api/auth/*.
 *
 * We can't import from lib/env here because middleware runs in the Edge
 * runtime and can't touch process.env eagerly through zod without
 * blowing up on missing values at build time. We only need SESSION_PASSWORD
 * and ALLOWED_EMAILS here, so read them directly.
 */

const PUBLIC = ["/login", "/api/auth/magic", "/api/auth/logout", "/manifest.webmanifest", "/sw.js"];
const PUBLIC_PREFIXES = ["/icons/", "/_next/", "/favicon"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const password = process.env.SESSION_PASSWORD;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!password || allowed.length === 0) {
    // App is misconfigured — surface it as a 500 rather than silently letting
    // anyone in.
    return new NextResponse("countpp: server env misconfigured", { status: 500 });
  }

  const res = NextResponse.next();
  const session = await getIronSession<CountppSession>(req, res, {
    password,
    cookieName: "countpp-session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  });

  const email = session.email?.toLowerCase();
  if (!email || !allowed.includes(email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
