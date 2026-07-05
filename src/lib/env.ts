import { z } from "zod";

/**
 * Environment schema for countpp.
 *
 * Fields that are secret (SESSION_PASSWORD, BLOB_READ_WRITE_TOKEN) are
 * required on the server. `NEXT_PUBLIC_*` values are safe to expose to
 * the client bundle.
 */
const serverSchema = z.object({
  SESSION_PASSWORD: z
    .string()
    .min(32, "SESSION_PASSWORD must be at least 32 characters (iron-session requirement)"),
  ALLOWED_EMAILS: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
    .refine((list) => list.length === 2, {
      message: "ALLOWED_EMAILS must contain exactly 2 comma-separated addresses",
    }),
  BLOB_READ_WRITE_TOKEN: z.string().min(1, "Vercel Blob token missing").optional(),
  APP_BASE_URL: z
    .string()
    .url("APP_BASE_URL must be a full URL, e.g. https://countpp.vercel.app")
    .optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("countpp"),
});

let cached: { server: z.infer<typeof serverSchema>; pub: z.infer<typeof publicSchema> } | null =
  null;

export function env() {
  if (cached) return cached;
  const server = serverSchema.parse({
    SESSION_PASSWORD: process.env.SESSION_PASSWORD,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });
  const pub = publicSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });
  cached = { server, pub };
  return cached;
}

export function displayName(email: string): "Asmit" | "Vidhi" | "?" {
  const e = email.toLowerCase();
  if (e === "asmitdash44@gmail.com") return "Asmit";
  if (e === "bhanushalividhi2@gmail.com") return "Vidhi";
  return "?";
}

export function initial(email: string): "A" | "V" | "?" {
  const n = displayName(email);
  return n === "Asmit" ? "A" : n === "Vidhi" ? "V" : "?";
}
