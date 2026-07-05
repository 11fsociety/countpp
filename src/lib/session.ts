import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { env } from "./env";

export interface CountppSession {
  email?: string;
  loggedInAt?: string; // ISO
}

export function sessionOptions(): SessionOptions {
  return {
    password: env().server.SESSION_PASSWORD,
    cookieName: "countpp-session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // 30 days
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export async function getSession() {
  const store = await cookies();
  return getIronSession<CountppSession>(store, sessionOptions());
}

export async function requireUser(): Promise<string> {
  const s = await getSession();
  if (!s.email) throw new Error("unauthenticated");
  const allowed = env().server.ALLOWED_EMAILS;
  if (!allowed.includes(s.email.toLowerCase())) throw new Error("not whitelisted");
  return s.email.toLowerCase();
}
