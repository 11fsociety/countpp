"use client";

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-300">
        Log out
      </button>
    </form>
  );
}
