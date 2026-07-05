/**
 * Vercel Blob helpers.
 *
 * Two shapes of data live in the same Blob store:
 *   - "metadata.txt" — the single JSON doc (see metadata.ts)
 *   - "photos/<ulid>.<ext>" — image blobs
 *
 * All calls go through server-side Route Handlers. The client never
 * uses the blob API directly.
 */

import { list, put, del } from "@vercel/blob";
import { EMPTY_METADATA, metadataSchema, type Metadata } from "./metadata";

const METADATA_PATHNAME = "metadata.txt";

export async function readMetadata(): Promise<Metadata> {
  // list() gives us the URL of the current metadata.txt if it exists.
  const { blobs } = await list({ prefix: METADATA_PATHNAME, limit: 5 });
  const current = blobs.find((b) => b.pathname === METADATA_PATHNAME);
  if (!current) return EMPTY_METADATA;
  const res = await fetch(current.url, { cache: "no-store" });
  if (!res.ok) return EMPTY_METADATA;
  try {
    const json = (await res.json()) as unknown;
    return metadataSchema.parse(json);
  } catch {
    // Corrupt or empty file — treat as fresh.
    return EMPTY_METADATA;
  }
}

export async function writeMetadata(m: Metadata): Promise<void> {
  const body = JSON.stringify(m, null, 2);
  await put(METADATA_PATHNAME, body, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function uploadPhoto(
  filename: string,
  contentType: string,
  body: ArrayBuffer | Blob,
): Promise<{ url: string; pathname: string }> {
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  // @vercel/blob's PutBody accepts Blob, Buffer, ReadableStream, File.
  // For an ArrayBuffer coming from `File.arrayBuffer()`, wrap in a Blob.
  const blobBody: Blob = body instanceof Blob ? body : new Blob([body], { type: contentType });
  const { url, pathname } = await put(`photos/${cleanName}`, blobBody, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return { url, pathname };
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}
