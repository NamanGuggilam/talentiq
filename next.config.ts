import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: __dirname },
  // Native or worker-loading packages that must not be bundled into server chunks.
  serverExternalPackages: ["@electric-sql/pglite", "mammoth", "postgres"],
  experimental: {
    // Resume uploads travel through a server action. Vercel caps request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
