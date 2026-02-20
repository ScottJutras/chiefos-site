import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "https://chief-ai-refactored.vercel.app";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return [
      // ✅ Billing API from Next domain → Express backend
      {
        source: "/api/billing/:path*",
        destination: `${BACKEND_ORIGIN}/api/billing/:path*`,
      },

      // IMPORTANT:
      // We intentionally do NOT rewrite /api/receipts/*
      // because Next owns /api/receipts/[transactionId] and proxies to core using CHIEF_CORE_API_BASE_URL.
    ];
  },
};

export default nextConfig;