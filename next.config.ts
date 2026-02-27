import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "https://chief-ai-refactored.vercel.app";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return [
      // ✅ Keep your existing billing rewrite
      {
        source: "/api/billing/:path*",
        destination: `${BACKEND_ORIGIN}/api/billing/:path*`,
      },

      /**
       * ✅ NEW: Portal proxy endpoints (Next domain → Express backend)
       * These are the ones your app calls during auth + dashboard load.
       */
      {
        source: "/api/whoami",
        destination: `${BACKEND_ORIGIN}/api/whoami`,
      },
      {
        source: "/api/health/entitlement",
        destination: `${BACKEND_ORIGIN}/api/health/entitlement`,
      },
      {
        source: "/api/revenue/list",
        destination: `${BACKEND_ORIGIN}/api/revenue/list`,
      },
      {
        source: "/api/tasks/list",
        destination: `${BACKEND_ORIGIN}/api/tasks/list`,
      },

      /**
       * ✅ Catch-all for any other backend /api routes you add later
       * IMPORTANT: This must come AFTER any Next-owned /api routes you want to keep local.
       *
       * You said:
       * - do NOT rewrite /api/receipts/*
       * so we explicitly exclude it by NOT adding a receipts rewrite
       * and by relying on "more specific routes win" behavior.
       *
       * If you later find /api/receipts is still being rewritten,
       * we can hard-exclude it via middleware or by moving receipts under /api/core/receipts.
       */
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;