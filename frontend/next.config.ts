import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSR mode (no static export) — required for /api/proxy/* routes that
  // forward requests server-side to the backend (avoids browser CORS).
  // Catalyst Slate runs "npm run dev" which starts Node.js — SSR is supported.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
