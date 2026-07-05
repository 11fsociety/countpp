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

## 7. Storage — Vercel Blob (locked 2026-07-05)

Drive is out. Photos + snap-photos live in Vercel Blob. Reason: zero setup, no Google Cloud console, matches Asmit's low-tinker preference.

- **Bucket:** one Vercel Blob store created from Vercel dashboard → Storage → Blob → "Create Store".
- **Access mode:** public URLs. Every blob has a permanent URL like `https://<random>.public.blob.vercel-storage.com/<key>.jpg`. URL is unguessable but not authenticated — treating this the same risk profile as the (rejected) Drive editor link.
- **Env vars:** `BLOB_READ_WRITE_TOKEN` auto-provisioned by Vercel when the store is linked to the project.
- **Uploads:** client → `POST /api/upload` route handler → `put()` from `@vercel/blob` → returns `{url, pathname}`. Route handler verifies session cookie + whitelist before letting the write through.
- **Reads:** the URL is embedded in `metadata.txt` (Blob URL, not Drive file ID). Client fetches the URL directly. No auth needed for reads (public blob).
- **"Access photos outside the app":** Vercel dashboard → Storage → Blob store → file list. Raw filenames, no thumbnails, no swipe viewer. Asmit acknowledged this UX trade-off and accepted it.

### Expiry / gallery lifetime (locked 2026-07-05)

- **Chat photos** (`type: "photo"`): visible in chat forever (unless purged via message-keep rules). In gallery: **7 days** from `capturedAt`.
- **Snap photos** (`type: "snap"`): visible in chat until viewed, then hidden. In gallery: **24 hours** from `capturedAt`.
- **Expiry behavior:** the blob **is NOT deleted**. Only the gallery UI hides it. The photo remains at its Vercel Blob URL and still shows in the Vercel dashboard. Asmit was warned about this "kind of gone, kind of not" state and explicitly accepted it.
- Implementation: gallery view filters `gallery` entries by `capturedAt >= now - windowFor(entry.type)`. No cleanup job, no deletes.

## 8. Tech stack

- **Framework:** Next.js 16 App Router with Turbopack.
- **Styling:** Tailwind CSS 4.
- **PWA:** `@ducanh2912/next-pwa` for the service worker + manifest.
- **UI kit:** minimal — Tailwind only.
- **Auth:** no email. `/login` page generates a signed magic-link URL and prints it on-screen. Asmit copies + sends to Vidhi via WhatsApp. She pastes in her phone browser. Session cookie set on click. Whitelist = env `ALLOWED_EMAILS=asmitdash44@gmail.com,bhanushalividhi2@gmail.com`.
- **Session:** `iron-session` for cookie-based sessions (no third-party auth service).
- **Storage:** `@vercel/blob` — photos + `metadata.txt` both live in Vercel Blob. Route handlers guard writes with session check + whitelist.
- **Deployment:** Vercel Free tier.

## 9. Decisions locked in (2026-07-04 / 05)

- **Storage:** Vercel Blob. Drive dropped after weighing OAuth setup cost against UX gain. See § 7.
- **Auth email:** none. Magic-link URL is generated + shown on-screen; Asmit sends to Vidhi via WhatsApp. See § 6.
- **Whitelist:** `asmitdash44@gmail.com` (Asmit), `bhanushalividhi2@gmail.com` (Vidhi). Hard-coded via env.
- **Chat-message purge (Q2):** 7 days for un-kept text messages.
- **Snap viewing (Q3):** snap paints for **15 seconds** on the recipient's open screen, then auto-marks `viewedAt`.
- **Photo compression (Q4):** none — originals uploaded as-is.
- **Push notifications (Q5):** zero, ever.
- **Gallery expiry (added 2026-07-05):** chat-photos hide from gallery after **7 days**; snap-photos hide after **24 hours**. Blobs are NOT deleted; only gallery UI hides them. Trade-off accepted.

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
