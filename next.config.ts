import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "https://chief-ai-refactored.vercel.app";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return [
      // Proxy billing API from the Next app domain → Express backend
      {
        source: "/api/billing/:path*",
        destination: `${BACKEND_ORIGIN}/api/billing/:path*`,
      },
    ];
  },
};

export default nextConfig;
