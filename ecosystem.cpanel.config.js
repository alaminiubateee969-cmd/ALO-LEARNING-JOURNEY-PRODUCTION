/* eslint-disable @typescript-eslint/no-require-imports -- PM2 config is CommonJS by design */
// cPanel-specific PM2 config (if you use PM2 on cPanel instead of Passenger).
// For standard cPanel "Node.js Application Manager" you DON'T need this file -
// just use Startup file: scripts/cpanel-start.mjs
// This file is for users on VPS/cPanel VPS hybrid who still use PM2.
const path = require("node:path");
const fs = require("node:fs");

const appName = process.env.PM2_APP_NAME || "learn-aloeducation";
// cPanel injects PORT - must respect it
const port = Number.parseInt(process.env.PORT || process.env.APP_PORT || "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535 (cPanel injects this)");
}
const releaseFile = path.join(__dirname, "RELEASE_SHA");
const releaseSha = process.env.RELEASE_SHA || (fs.existsSync(releaseFile) ? fs.readFileSync(releaseFile, "utf8").trim() : "unknown");

module.exports = {
  apps: [
    {
      name: appName,
      script: path.join(__dirname, ".next/standalone/server.js"),
      interpreter: "node",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: port,
        // IMPORTANT: cPanel containers proxy via network, must bind 0.0.0.0 not 127.0.0.1
        HOSTNAME: "0.0.0.0",
        RELEASE_SHA: releaseSha,
      },
    },
  ],
};
