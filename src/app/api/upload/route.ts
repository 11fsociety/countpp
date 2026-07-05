import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { uploadPhoto } from "@/lib/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB — no client-side compression, so cap uploads

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "no-form" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no-file" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "too-big" }, { status: 413 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not-image" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const { url, pathname } = await uploadPhoto(file.name || "photo.jpg", file.type, buffer);
  return NextResponse.json({ url, pathname });
}
