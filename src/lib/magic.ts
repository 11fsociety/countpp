/**
 * Magic-link generator + verifier.
 *
 * A magic link is a URL like:
 *   https://<app>/api/auth/magic?email=<email>&exp=<unix>&sig=<hmac>
 *
 * The signature is HMAC-SHA256 over `${email}|${exp}` using SESSION_PASSWORD
 * as the shared secret. Anyone who has the SESSION_PASSWORD (only Vercel
 * env) can forge a link. Anyone else cannot.
 *
 * Flow:
 *   1. Asmit opens /login on his phone, enters "asmitdash44@gmail.com".
 *   2. Server checks whitelist, generates a link, prints it on screen.
 *   3. Asmit copies the link, sends it to Vidhi over WhatsApp.
 *      (or: Asmit clicks it himself to log in on his own phone.)
 *   4. Vidhi opens the link on her phone. Server verifies signature +
 *      expiry, sets session cookie, redirects to /count.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

function sign(payload: string): string {
  const key = env().server.SESSION_PASSWORD;
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function generateMagicLink(baseUrl: string, email: string): string {
  const cleaned = email.trim().toLowerCase();
  const exp = Date.now() + LINK_LIFETIME_MS;
  const payload = `${cleaned}|${exp}`;
  const sig = sign(payload);
  const url = new URL("/api/auth/magic", baseUrl);
  url.searchParams.set("email", cleaned);
  url.searchParams.set("exp", exp.toString());
  url.searchParams.set("sig", sig);
  return url.toString();
}

export function verifyMagicLink(email: string, exp: string, sig: string):
  | { ok: true; email: string }
  | { ok: false; reason: "expired" | "bad-sig" | "malformed" } {
  const cleaned = email.trim().toLowerCase();
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || !cleaned || !sig) return { ok: false, reason: "malformed" };
  if (Date.now() > expNum) return { ok: false, reason: "expired" };
  const expected = sign(`${cleaned}|${exp}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return { ok: false, reason: "bad-sig" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "bad-sig" };
  return { ok: true, email: cleaned };
}
