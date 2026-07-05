# Deploying countpp to Vercel

One-time setup. Should take ~10 minutes end-to-end.

## 1. Import the repo into Vercel

- Go to https://vercel.com/new
- Import Git Repository → pick `11fsociety/countpp`
- Framework preset: **Next.js** (auto-detected)
- Root directory: `./` (leave default)
- Click **Deploy** — the first build will fail (no env vars yet). That's fine, we set them next.

## 2. Create the Blob store and link it

- In the Vercel project → **Storage** tab → **Create Store** → **Blob** → give it a name (e.g. `countpp-blob`)
- Vercel auto-adds a `BLOB_READ_WRITE_TOKEN` env var to the project. Confirm it's there under **Settings → Environment Variables**.

## 3. Add the remaining env vars

Under **Settings → Environment Variables**, add these for all environments (production, preview, development):

| Name | Value |
|---|---|
| `SESSION_PASSWORD` | Any random string, minimum 32 characters. Generate: `openssl rand -base64 48` |
| `ALLOWED_EMAILS` | `asmitdash44@gmail.com,bhanushalividhi2@gmail.com` |
| `APP_BASE_URL` | Your prod URL, e.g. `https://countpp.vercel.app` (fill in after first successful deploy assigns a URL) |

`BLOB_READ_WRITE_TOKEN` should already be there from step 2.

## 4. Redeploy

- In **Deployments** tab, click the "..." on the latest failed deployment → **Redeploy** (uncheck "use existing build cache" for the first successful one).
- After ~1-2 min it should show a green ✓.

## 5. Test on your phone

- Open your production URL on your phone (Chrome for Android, Safari for iOS).
- You should land on `/login`.
- Enter your email (`asmitdash44@gmail.com`). Click **Generate magic link**.
- Two ways to log in from here:
  - **Just open it here** button — logs you in on this device
  - **Copy link** button — send to Vidhi via WhatsApp so she can log in on her phone
- After login you land on `/count`.

## 6. Install as PWA

**Android (Chrome):**
- Menu (⋮) → **Add to Home screen** → confirm.
- Icon appears on home screen. Tapping it opens countpp full-screen without browser chrome.

**iOS (Safari):**
- Share sheet → **Add to Home Screen** → Add.
- Same effect.

## 7. Sanity-check the loop

- On your phone: tap the count button. Number goes up.
- Get Vidhi logged in on her phone.
- She taps her count button. Within ~5 seconds your phone shows her new number.
- She sends a photo. Wait ~5s. Photo appears in your chat.
- Open gallery. Photo is in the grid.
- Long-press → **Keep forever** to make it survive past 7 days.

## Known behaviors

- **No push notifications.** By design. You have to open the app to see changes.
- **Blob overwrite race:** if you and Vidhi both mutate `metadata.txt` within the same second, last write wins. On next poll (~4s later) both clients re-fetch the winning state. Not perfect but fine for 2 users.
- **Snap gallery lifetime is 24h**, chat-photo gallery lifetime is 7d, kept-forever photos never expire.
- **Expired photos are hidden but not deleted.** They're still in the Vercel Blob dashboard.
- **Magic-link expiry is 24h** from generation.

## Troubleshooting

- Login page loops back to login → `SESSION_PASSWORD` is missing, malformed (< 32 chars), or changed across deployments (which invalidates existing cookies).
- `/api/upload` returns 401 → session cookie missing. Log out, log in, try again.
- `/api/state` 500 → `BLOB_READ_WRITE_TOKEN` env var missing or bad. Check the Vercel Storage tab.
- PWA "Add to Home Screen" not appearing on Android → make sure you're on HTTPS (production), not an IP address. Also Chrome sometimes hides the prompt for the first N visits; try refreshing.
