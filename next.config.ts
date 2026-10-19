import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // cPanel Note: standalone output is required for cPanel Node.js app.
  // The build copies .next/static + public into .next/standalone so
  // `node .next/standalone/server.js` works both locally and in cPanel containers.
  reactStrictMode: false,
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
