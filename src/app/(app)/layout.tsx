import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { displayName } from "@/lib/env";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  if (!s.email) redirect("/login");
  const name = displayName(s.email);

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
        <div className="text-sm">
          <span className="text-neutral-400">Signed in as</span>{" "}
          <span className="font-medium">{name}</span>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-neutral-900 bg-neutral-950/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-3 text-sm">
          <NavLink href="/count" label="Count" />
          <NavLink href="/chat" label="Chat" />
          <NavLink href="/gallery" label="Gallery" />
        </div>
      </nav>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="py-4 text-center text-neutral-300 hover:text-neutral-100 active:text-neutral-100"
    >
      {label}
    </Link>
  );
}
