import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos are compressed in the browser first (≈300 KB each, max 4 per
      // form); this leaves headroom while staying under Vercel's 4.5 MB
      // request limit.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
