import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "https://www.usechiefos.com";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return [
      // ✅ Proxy most API routes to Express backend
      // (Keep receipts owned by Next if you truly have Next API route for it)
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },

      // If you want to exclude receipts specifically, you can do:
      // { source: "/api/receipts/:path*", destination: "/api/receipts/:path*" }
      // BUT: Next rewrites don’t support “destination to self” cleanly like that.
      // The practical approach is: decide who owns /api/receipts.
    ];
  },
};

export default nextConfig;