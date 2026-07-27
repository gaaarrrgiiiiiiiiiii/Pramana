import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "https://pramana-api-50044352049.development.catalystappsail.in/:path*",
      },
    ];
  },
};

export default nextConfig;
