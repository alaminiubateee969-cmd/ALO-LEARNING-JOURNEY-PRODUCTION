/* eslint-disable @typescript-eslint/no-require-imports -- PM2 config is CommonJS by design */
// PM2 production config. `scripts/deploy-production.sh` loads this file via
// APP_DIR/current, so __dirname is the selected release. The VPS path is
// operator-configured and intentionally not hard-coded here.
// Absolute script path + explicit cwd avoid ENOENT: uv_cwd if a directory
// PM2 was started from is later replaced.
const path = require("node:path");
const fs = require("node:fs");
const appName = process.env.PM2_APP_NAME || "learn-aloeducation";
const port = Number.parseInt(process.env.APP_PORT || "3017", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("APP_PORT must be an integer between 1 and 65535");
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
        HOSTNAME: "127.0.0.1",
        RELEASE_SHA: releaseSha,
      },
    },
  ],
};
