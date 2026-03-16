import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  // IMPORTANT:
  // Do NOT blanket-rewrite /api/* to the Express backend.
  // This app owns real Next route handlers under app/api/*,
  // including intake, whoami, link-phone proxy routes, etc.
  //
  // Any backend calls that still need to go to core should be done
  // through explicit Next route handlers using proxyToCore(),
  // not through a global rewrite that hijacks all /api paths.
  async rewrites() {
    return [];
  },
};

export default nextConfig;