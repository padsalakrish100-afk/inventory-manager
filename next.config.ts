import type { NextConfig } from "next";

// Sent with every page and API response.
const SECURITY_HEADERS = [
  // The app is never shown inside another site's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera for the stone scanner; nothing else.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  // The logo is read from disk when building PDFs; ship it with those routes.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./public/brand/logo.png"],
    "/api/export/**": ["./public/brand/logo.png"],
  },
  experimental: {
    serverActions: {
      // Photos are compressed in the browser first (≈300 KB each, max 4 per
      // form); this leaves headroom while staying under Vercel's 4.5 MB
      // request limit.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
