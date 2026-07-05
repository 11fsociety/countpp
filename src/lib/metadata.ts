/**
 * metadata.txt — the single source of truth for count, chat, gallery.
 *
 * One JSON document. Stored as a single blob under the key
 * "metadata.txt" in the Vercel Blob store. Rewritten atomically on
 * every mutating action (get -> mutate in memory -> put).
 *
 * Concurrent-write behavior: `put()` with the same pathname is
 * last-write-wins. That is a design trade-off. In practice the polling
 * loop re-reads state within 3-5s and stale UI reconciles itself.
 */

import { z } from "zod";

export const chatMessageSchema = z.object({
  id: z.string(),
  sender: z.string().email(),
  createdAt: z.string(),
  type: z.enum(["text", "photo", "snap"]),
  text: z.string().optional(),
  blobUrl: z.string().url().optional(),
  viewedAt: z.string().nullable().default(null),
  keptBy: z.array(z.string().email()).default([]),
  deleted: z.boolean().default(false),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const galleryEntrySchema = z.object({
  blobUrl: z.string().url(),
  sender: z.string().email(),
  capturedAt: z.string(),
  sourceMsgId: z.string(),
  sourceType: z.enum(["photo", "snap"]),
  keptBy: z.array(z.string().email()).default([]),
});
export type GalleryEntry = z.infer<typeof galleryEntrySchema>;

export const metadataSchema = z.object({
  version: z.literal(1),
  lastWriter: z.string().email().nullable().default(null),
  lastWriteAt: z.string().nullable().default(null),
  count: z.object({
    value: z.number().int().default(0),
    lastChangeBy: z.string().email().nullable().default(null),
    lastChangeAt: z.string().nullable().default(null),
  }),
  chat: z.array(chatMessageSchema).default([]),
  gallery: z.array(galleryEntrySchema).default([]),
});
export type Metadata = z.infer<typeof metadataSchema>;

export const EMPTY_METADATA: Metadata = {
  version: 1,
  lastWriter: null,
  lastWriteAt: null,
  count: { value: 0, lastChangeBy: null, lastChangeAt: null },
  chat: [],
  gallery: [],
};

export const CHAT_PURGE_DAYS = 7;
export const CHAT_PHOTO_GALLERY_DAYS = 7;
export const SNAP_GALLERY_HOURS = 24;
export const SNAP_VIEW_MS = 15_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Given a gallery entry, return the moment it "expires" from the gallery UI.
 * Kept photos never expire (return null).
 */
export function galleryExpiresAt(entry: GalleryEntry): Date | null {
  if (entry.keptBy.length > 0) return null;
  const captured = new Date(entry.capturedAt).getTime();
  const windowMs = entry.sourceType === "snap" ? SNAP_GALLERY_HOURS * HOUR_MS : CHAT_PHOTO_GALLERY_DAYS * DAY_MS;
  return new Date(captured + windowMs);
}

/**
 * Returns true if the entry should currently appear in the gallery view.
 */
export function isVisibleInGallery(entry: GalleryEntry, now: Date = new Date()): boolean {
  const exp = galleryExpiresAt(entry);
  if (exp === null) return true; // kept-forever
  return now.getTime() < exp.getTime();
}

/**
 * Returns how many milliseconds until expiry, or null if kept-forever
 * or already expired.
 */
export function msUntilExpiry(entry: GalleryEntry, now: Date = new Date()): number | null {
  const exp = galleryExpiresAt(entry);
  if (exp === null) return null;
  const delta = exp.getTime() - now.getTime();
  return delta > 0 ? delta : null;
}

/**
 * Should an expiry countdown badge be shown on this entry right now?
 * Rule: only show when we're in the last 25% of the entry's lifetime.
 */
export function shouldShowCountdown(entry: GalleryEntry, now: Date = new Date()): boolean {
  if (entry.keptBy.length > 0) return false;
  const captured = new Date(entry.capturedAt).getTime();
  const windowMs = entry.sourceType === "snap" ? SNAP_GALLERY_HOURS * HOUR_MS : CHAT_PHOTO_GALLERY_DAYS * DAY_MS;
  const elapsed = now.getTime() - captured;
  return elapsed >= 0.75 * windowMs && elapsed < windowMs;
}

/**
 * Apply chat purge: keep only messages where `keptBy` is non-empty
 * OR whose `createdAt` is within the purge window.
 */
export function purgeChat(chat: ChatMessage[], now: Date = new Date()): ChatMessage[] {
  const cutoff = now.getTime() - CHAT_PURGE_DAYS * DAY_MS;
  return chat.filter((m) => m.keptBy.length > 0 || new Date(m.createdAt).getTime() >= cutoff);
}

/**
 * Format ms into a compact "3d" / "12h" / "45m" / "30s" string.
 */
export function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
