import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel Blob public URLs
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // The middleware needs iron-session which uses node:crypto. Force Node runtime.
  serverExternalPackages: ["iron-session"],
};

export default nextConfig;
