# countpp — full design

## 1. Scope

Two humans (Asmit + one specific other person). One installed-to-home-screen PWA. Three surfaces: count, chat, gallery. Universal / shared state — no per-user views, no notifications, no third users, no groups.

Constraints locked in during scoping:
- **Sync latency budget:** 3–5 sec polling. Explicitly *not* real-time.
- **Datastore:** a single Google Drive folder shared with editor-level "anyone with the link" access.
- **Metadata:** a single `metadata.txt` inside the same Drive folder.
- **Auth:** magic-link email, whitelist of 2 addresses.
- **No backend, no database.** Everything runs in the browser.

## 2. Data model — `metadata.txt`

One JSON document. The whole file gets rewritten on every mutating action.

```jsonc
{
  "version": 1,
  "lastWriter": "<email>",
  "lastWriteAt": "<iso timestamp>",
  "count": { "value": 0, "lastChangeBy": "<email>", "lastChangeAt": "<iso>" },
  "chat": [
    {
      "id": "msg-<ulid>",
      "sender": "<email>",
      "type": "text" | "photo" | "snap",
      "createdAt": "<iso>",
      "text": "<if type=text>",
      "driveFileId": "<if type=photo|snap>",
      "viewedAt": "<iso | null>",
      "keptBy": ["<email>", ...],
      "deleted": false
    }
  ],
  "gallery": [
    {
      "driveFileId": "<gdrive file id>",
      "sender": "<email>",
      "capturedAt": "<iso>",
      "sourceMsgId": "msg-<ulid>"
    }
  ]
}
```

Fields:
- **`count.value`** — the shared integer.
- **`chat`** — chronological array of messages. New messages appended to the end.
- **`gallery`** — every photo ever sent (both snap and regular), by `driveFileId`. The chat entry is separate; even after a snap is "viewed" and hidden from chat UI, its gallery entry persists.
- **`keptBy`** — list of emails who long-pressed to keep this message. If empty **and** `createdAt` is older than the purge window, the message is dropped from `chat` on the next write. Kept-by-either survives.

## 3. Photo flow

1. User taps camera → file picker → user selects (or captures) an image.
2. Client uses the Drive API to `POST /upload/drive/v3/files?uploadType=multipart` targeting the shared folder ID. Returns a `driveFileId`.
3. Client reads current `metadata.txt`, appends the new message entry to `chat` and the gallery entry to `gallery`, writes the file back to Drive.
4. On the other client's next poll, the new message appears.

## 4. View-once logic

- A `snap`-type message is rendered in chat only while `viewedAt` is `null`.
- Once the *recipient* opens the chat and looks at the snap (implemented as: their client detects the snap is on-screen and paints for 3 seconds), the client writes `viewedAt = now` to `metadata.txt`.
- The snap disappears from chat UI on both sides after `viewedAt` is set.
- The `driveFileId` remains — the photo is still accessible via `/gallery`.
- **Regular photo** (`type: "photo"`) stays in chat forever. The distinction between snap and photo is the sender's choice at send time.

## 5. Keep + purge for text messages

- Purge window: **7 days**, configurable in code.
- On any read of `metadata.txt`, the client applies purge: filter `chat` to entries where either `keptBy` is non-empty OR `createdAt` >= (now - 7 days).
- Filtered result is written back on the next mutating action.
- Long-press on a message → adds current user's email to `keptBy` and writes back.

## 6. Auth flow

- Vercel deployment behind a middleware that:
  - Requires a signed session cookie.
  - Session cookie issued by the app after magic-link click.
- Magic link: user enters email → server sends a signed URL with `?token=<jwt>` → clicking sets the session cookie.
- Whitelist: env var `ALLOWED_EMAILS="asmit@example.com,her@example.com"`. Requests from any other email get a "not authorized" screen after the magic-link click.
- Because there are 2 users only, we can hardcode friendly display names against the two emails.

**Note:** the magic-link server has to send email. Options: Vercel's edge email via Resend / Postmark / SendGrid (Resend has a generous free tier). Server-side only; the client never sees SMTP keys.

## 7. Drive integration

- **Setup (one-time, by Asmit):**
  - Create a Drive folder named "countpp-data".
  - Right-click → Share → "Anyone with the link" → Editor.
  - Copy the folder ID from the URL (`https://drive.google.com/drive/folders/<ID>`).
  - Put the ID in Vercel env var `DRIVE_FOLDER_ID`.
- **Client-side Drive API access:**
  - Uses an unauthenticated Drive REST endpoint that works with "anyone with the link" folders? **NO** — the Drive REST API always requires OAuth even for public-link folders. There is no anonymous-access path for programmatic writes.
  - Workaround: an **API key** with Drive API enabled, restricted to the specific folder ID + specific referrers. But **API keys can only read**, not write.
  - Realistic option: the client does OAuth with the **user's own** Google account, and the user's Google account uploads to the shared folder. Both users go through OAuth on first use.
  - This contradicts the "no OAuth" preference stated during scoping. Flagging: we may have to soften either "no OAuth" or "no backend."

  **Decision needed** — see § 9 open questions.

## 8. Tech stack

- **Framework:** Next.js 16 App Router with Turbopack.
- **Styling:** Tailwind CSS.
- **PWA:** `@ducanh2912/next-pwa` for the service worker + manifest.
- **UI kit:** minimal — Tailwind only. Framer Motion for the button-tap animation.
- **Email:** Resend for magic-link delivery.
- **Session:** `iron-session` for cookie-based sessions (no third-party auth service).
- **Drive:** the `googleapis` npm client, called from Next.js Route Handlers (**this means we DO have a backend, contradiction with scoping** — see § 9).
- **Deployment:** Vercel Free tier.

## 9. Decisions locked in (2026-07-04)

- **Drive access (Q1):** option (a) — Vercel serverless backend with a Google service account. Env var `GOOGLE_SERVICE_ACCOUNT_KEY` holds the credential JSON. All Drive I/O goes through `/api/drive-*` route handlers. Neither user OAuths against Google.
- **Purge window (Q2):** 7 days (default from plan).
- **Snap viewing (Q3):** snap paints for **15 seconds** on the recipient's open screen, then auto-marks `viewedAt`. No tap-and-hold gesture.
- **Photo compression (Q4):** none — originals uploaded as-is. Accept larger storage footprint.
- **Push notifications (Q5):** zero, ever. No badge, no push, no service-worker notifications.

## 9b. Open questions before implementation (kept for reference)

**Q1. Drive OAuth vs backend contradiction.** During scoping we agreed "no backend, everything client-side." But the Drive API cannot be called anonymously from the browser, even against an "anyone with the link" folder. Three ways to resolve:

- **(a) Add a Vercel serverless backend** that holds a Drive service-account credential, uploads on behalf of the app. Both users' phones just call the backend. Fully private; only the service account has Drive access.
- **(b) Each user does OAuth against their own Google account on first use.** The two users' Google accounts both have edit access to the shared folder. Client does the upload directly.
- **(c) Drop Drive entirely, use Supabase Storage or Vercel Blob.** Purpose-built, private-by-default, no OAuth needed. Photos still show up in the app; gallery works the same.

**Q2. Purge window.** 7 days for un-kept messages. Adjust?

**Q3. Snap "viewed" timing.** Currently: paints for 3 seconds on the recipient's screen → marks viewed. Snapchat-style is more like "tap-and-hold to view, release to close." Which behaviour?

**Q4. Photo compression.** Photos taken on modern phones are 3–10 MB. That eats Drive quota fast. Auto-resize to 1920px max width, JPEG q80 before upload? (Recommended.)

**Q5. Push notifications.** Explicitly said "no notifications" — confirming we mean this. No badge count, no home-screen notification banner, no ping-when-she-taps-count. She has to open the app to see new state.

## 10. Build plan (once open questions are answered)

Phase 1 — scaffold + auth (est. 1 evening):
- `npx create-next-app@latest countpp --typescript --tailwind --app`
- Install `@ducanh2912/next-pwa`, `iron-session`, `resend`, `googleapis`.
- Wire magic-link auth with 2-email whitelist.
- Deploy to Vercel; get PWA install working on a real phone.

Phase 2 — count feature (est. 1 evening):
- Big circular button.
- `+1 / +2 / +5` selector.
- Client reads `metadata.txt`, mutates `count.value`, writes back.
- 3-second polling loop → count number updates when the other person taps.

Phase 3 — chat (est. 2 evenings):
- Message input.
- Long-press to keep, swipe to delete.
- Purge logic on read.
- View-once photo type.

Phase 4 — gallery (est. 1 evening):
- Grid view of every photo in the shared Drive folder.
- Tap to full-screen.
- Sort by capturedAt desc.

Total est: ~5 evenings for MVP once Q1 is decided.

## 11. What's NOT in scope

- Push notifications.
- Any third user.
- Voice / video calls.
- Message reactions or emoji picker.
- Any dashboard, statistics, or history export.
- Any admin surface for managing the whitelist — it's env-var only.
- iOS App Store or Play Store distribution — PWA-only.
