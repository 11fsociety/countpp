"use client";

import { useState, useTransition } from "react";

interface Props {
  action: (fd: FormData) => Promise<{ error?: string; link?: string }>;
}

export function LoginForm({ action }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setLink(null);
        startTransition(async () => {
          const res = await action(fd);
          if (res.error) setError(res.error);
          if (res.link) setLink(res.link);
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm text-neutral-300">
          Your email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-100 text-neutral-950 py-3 font-medium disabled:opacity-50 transition-opacity"
      >
        {pending ? "Generating link..." : "Generate magic link"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {link && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-neutral-400">
            Copy this link and open it on the phone you want to log in on. Anyone with the link can log in as this
            email for the next 24 hours.
          </p>
          <div className="rounded-lg bg-neutral-900 border border-neutral-800 p-3 break-all font-mono text-xs text-neutral-300">
            {link}
          </div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="w-full rounded-lg bg-neutral-800 text-neutral-100 py-2 text-sm border border-neutral-700"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <a
            href={link}
            className="block text-center w-full rounded-lg bg-neutral-100 text-neutral-950 py-2 text-sm font-medium"
          >
            Or just open it here
          </a>
        </div>
      )}
    </form>
  );
}
