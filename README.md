# countpp

A two-person PWA for one specific pair of people. Nothing more.

## What it does

Three features, one shared surface between exactly two accounts:

1. **A shared count.** One big circular button. Tap it to bump the count by `+1`, `+2`, or `+5`. The number is universal — she taps, I see it change; I tap, she sees it change. The meaning of the count is whatever we decide it is.

2. **A view-once chat.** Modern, minimal, no notifications. Messages are visible until viewed by the other person; long-press a message to mark **keep** and it stays forever. Anything not kept auto-purges after a rolling window.

3. **A snap-style photo stream.** Send a photo, the other person views it once, then it disappears from the chat UI but is still stored in the shared gallery for later browsing.

## How it works

- **Frontend:** Next.js 16 PWA (installable on Android / iOS home screen), deployed to Vercel.
- **Auth:** magic-link, no email. The `/login` page generates a signed URL and prints it on screen — the sender copies it and sends to the recipient via WhatsApp. Only two whitelisted addresses can log in via that link.
- **Storage:** Vercel Blob.
  - Photos + snap-photos live in one Vercel Blob store.
  - `metadata.txt` (chat messages, count value, message-kept flags, view state, per-photo gallery lifetime) lives in the same Blob store.
  - The client polls Vercel Blob every 3–5 seconds to detect changes.

## Trade-offs we're deliberately choosing

- **Real-time is ~3–5 sec polling delay**, not sub-second. Deliberate.
- **Chat photos hide from gallery after 7 days; snap photos hide after 24 hours** — but the blobs themselves are not deleted. Expired photos still exist in the Vercel Blob dashboard and at their public URLs. This is "hidden, not gone" — accepted trade-off.
- **`metadata.txt` has a race-condition risk** on simultaneous writes. Mitigation is client-side (last-write-wins with a re-read-after-write reconciliation).

## Full design

See [`plans/countpp.md`](plans/countpp.md).
