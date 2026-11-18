import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cPanel Note: standalone output is required for cPanel Node.js app.
  // The build copies .next/static + public into .next/standalone so
  // `node .next/standalone/server.js` works both locally and in cPanel containers.
  output: "standalone",
  reactStrictMode: false,
  // Sharp is lazy-loaded (src/lib/image-processing.ts) and must stay out of the
  // server bundle so builds work on the x86-64-v1 VPS CPU (no SSE4.2).
  // tests/image-processing.test.mjs guards this line.
  serverExternalPackages: ["sharp"],
  // Dev-server only: hosts allowed to load /_next assets during `next dev`.
  allowedDevOrigins: ["127.0.0.1", "localhost", "21.0.4.113", "103.231.239.79", "marketing.alolabs.net"],
};

export default nextConfig;
