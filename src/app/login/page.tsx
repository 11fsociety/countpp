import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { generateMagicLink } from "@/lib/magic";
import { LoginForm } from "./login-form";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function submit(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  if (!email) return { error: "Enter an email." };
  const allowed = env().server.ALLOWED_EMAILS;
  if (!allowed.includes(email)) return { error: "That email isn't on the whitelist." };

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const base = env().server.APP_BASE_URL ?? `${proto}://${host}`;

  const link = generateMagicLink(base, email);
  return { link };
}

export default async function LoginPage() {
  const session = await getSession();
  if (session.email) redirect("/count");
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">countpp</h1>
          <p className="text-sm text-neutral-400 mt-1">Two people. One count. Everything else that comes with it.</p>
        </div>
        <LoginForm action={submit} />
      </div>
    </main>
  );
}
