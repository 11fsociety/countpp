# countpp

A two-person PWA for one specific pair of people. Nothing more.

## What it does

Three features, one shared surface between exactly two accounts:

1. **A shared count.** One big circular button. Tap it to bump the count by `+1`, `+2`, or `+5`. The number is universal — she taps, I see it change; I tap, she sees it change. The meaning of the count is whatever we decide it is.

2. **A view-once chat.** Modern, minimal, no notifications. Messages are visible until viewed by the other person; long-press a message to mark **keep** and it stays forever. Anything not kept auto-purges after a rolling window.

3. **A snap-style photo stream.** Send a photo, the other person views it once, then it disappears from the chat UI but is still stored in the shared gallery for later browsing.

## How it works

- **Frontend:** Next.js 16 PWA (installable on Android / iOS home screen), deployed to Vercel.
- **Auth:** magic-link email. Only two whitelisted addresses can sign in.
- **Datastore:** a single Google Drive folder shared with editor-link access.
  - Photos + snap-photos live in that folder as blobs.
  - Chat messages, count value, message-kept flags, view state — all live in a single `metadata.txt` inside the same folder.
  - **No backend, no database, no realtime infra.** The client polls the Drive folder every 3–5 seconds to detect changes.

## Trade-offs we're deliberately choosing

- **Real-time is ~3–5 sec polling delay**, not sub-second. Deliberate. See design doc.
- **The Drive folder link is a shared secret.** Anyone with the link has full access. Acceptable for a two-person tool where the link never leaves those two devices.
- **`metadata.txt` has a race-condition risk** on simultaneous writes. Mitigation is client-side (last-write-wins with a re-read-after-write reconciliation). See design doc.

## Full design

See [`plans/countpp.md`](plans/countpp.md).
