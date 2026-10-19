#!/usr/bin/env node
/**
 * cPanel Node.js Application Manager startup shim
 * ------------------------------------------------
 * cPanel injects PORT dynamically and expects the app to listen on
 * process.env.PORT. Some cPanel/Passenger setups also set a different
 * working directory. This shim:
 *  1) Normalizes PORT/HOSTNAME so Next.js standalone server binds correctly
 *  2) Ensures storage directories exist (cPanel wipes them on rebuild otherwise)
 *  3) Logs diagnostics that appear in cPanel "Logs" panel
 *  4) Delegates to the Next.js standalone server (no extra dependency)
 *
 * Usage in cPanel "Startup file" or "Startup command":
 *   node scripts/cpanel-start.mjs
 * or via npm:
 *   npm run cpanel:start
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const cwd = process.cwd();
console.log(`[cpanel] cwd=${cwd}`);
console.log(`[cpanel] node=${process.version} pid=${process.pid}`);

// --- 1. Normalize PORT / HOSTNAME -----------------------------------------
// cPanel may set PORT to something like 3000, 12007, or 5000. Respect it.
// If not set, fall back to 3000 (matches your logs) or 3017 (VPS default).
const originalPort = process.env.PORT;
if (!process.env.PORT) {
  // prefer cPanel injected PORT, fallback to 3000
  process.env.PORT = process.env.APP_PORT || "3000";
  console.log(`[cpanel] PORT was not set by cPanel, defaulting to ${process.env.PORT}`);
} else {
  console.log(`[cpanel] using cPanel-injected PORT=${process.env.PORT} (original)`);
}

// HOSTNAME must be 0.0.0.0 for cPanel containers (they proxy via network).
// If user left it as 127.0.0.1 from VPS config, the proxy can't reach the app.
if (!process.env.HOSTNAME || process.env.HOSTNAME === "127.0.0.1") {
  const prev = process.env.HOSTNAME || "(unset)";
  process.env.HOSTNAME = "0.0.0.0";
  console.log(`[cpanel] HOSTNAME ${prev} -> 0.0.0.0 (required for cPanel proxy)`);
} else {
  console.log(`[cpanel] HOSTNAME=${process.env.HOSTNAME}`);
}

// NODE_ENV must be production for standalone server to disable dev overlay
if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";
console.log(`[cpanel] NODE_ENV=${process.env.NODE_ENV}`);

// --- 2. Ensure storage dirs exist ------------------------------------------
// Relative to cwd which is /home/aloeduca/learn.aloeducation.com on your host
const dirs = [
  process.env.UPLOAD_DIR || "./storage/uploads",
  process.env.VIDEO_DIR || "./storage/videos",
  "./storage/audio",
  "./storage/backups",
  "./storage/scene-assets",
];
for (const d of dirs) {
  const abs = path.isAbsolute(d) ? d : path.resolve(cwd, d);
  try {
    fs.mkdirSync(abs, { recursive: true });
    console.log(`[cpanel] storage ready: ${abs}`);
  } catch (e) {
    console.warn(`[cpanel] could not create ${abs}: ${e.message}`);
  }
}

// --- 3. Diagnostics (visible in cPanel logs) --------------------------------
const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.warn("[cpanel] WARNING: DATABASE_URL is not set - app will run in degraded mode (no DB). Set it in cPanel Application Manager > Environment Variables.");
} else {
  const scheme = dbUrl.split(":")[0];
  const masked = scheme + "://***@" + (dbUrl.split("@")[1] || "host");
  console.log(`[cpanel] DATABASE_URL scheme=${scheme} (${masked.slice(0, 80)}...)`);
  if (scheme !== "mysql" && scheme !== "mysqls") {
    console.warn(`[cpanel] WARNING: production DATABASE_URL must be mysql:// (got ${scheme}:). SQLite/file is dev-only fallback.`);
  }
}
if (!process.env.NEXTAUTH_SECRET) console.warn("[cpanel] WARNING: NEXTAUTH_SECRET not set - admin login will fail closed in production");
if (!process.env.NEXTAUTH_URL) console.warn(`[cpanel] WARNING: NEXTAUTH_URL not set - should be https://learn.aloeducation.com (your domain)`);
if (!process.env.ADMIN_EMAIL) console.warn("[cpanel] WARNING: ADMIN_EMAIL not set");
// Email (cPanel) diagnostics — mirrors BrandSettings SMTP card
const smtpHost = process.env.SMTP_HOST || "learn.aloeducation.com";
const smtpPort = process.env.SMTP_PORT || "465";
const smtpUser = process.env.SMTP_USER || "info@learn.aloeducation.com";
if (!process.env.SMTP_PASS) {
  console.warn(`[cpanel] SMTP: host=${smtpHost}:${smtpPort} user=${smtpUser} — SMTP_PASS not set (set in cPanel → Application Manager → Environment Variables → value from cPanel → Email Accounts → info@learn.aloeducation.com password). Outbound mail will fail until set. IMAP: learn.aloeducation.com:993`);
} else {
  console.log(`[cpanel] SMTP ready: ${smtpHost}:${smtpPort} as ${smtpUser} (IMAP 993 for inbox) — https://www.facebook.com/ALOLearningJourney · 01805-020103`);
}

// --- 4. Locate and launch standalone server ---------------------------------
const candidates = [
  path.join(cwd, ".next/standalone/server.js"), // after `npm run build` with standalone output
  path.join(cwd, "server.js"),                  // Docker runner copies to /app/server.js
];

let serverEntry = null;
for (const c of candidates) {
  if (fs.existsSync(c)) {
    serverEntry = c;
    break;
  }
  console.log(`[cpanel] not found: ${c}`);
}

if (!serverEntry) {
  console.error("[cpanel] ERROR: Could not find Next.js standalone server.");
  console.error("[cpanel] Looked in:");
  for (const c of candidates) console.error(`  - ${c}`);
  console.error("[cpanel] Did you set Build Command to: npm ci && npx prisma generate && npm run build ?");
  console.error("[cpanel] Check cPanel > Application Manager > Build command and click 'Run Build' or 'Deploy'.");
  process.exitCode = 1;
  // keep process alive briefly so cPanel shows the error in logs
  setTimeout(() => process.exit(1), 500);
} else {
  console.log(`[cpanel] launching: node ${serverEntry}`);
  console.log(`[cpanel] listening on http://${process.env.HOSTNAME}:${process.env.PORT} (proxied to https://learn.aloeducation.com)`);

  const child = spawn(process.execPath, [serverEntry], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    console.error(`[cpanel] server exited code=${code} signal=${signal}`);
    process.exit(code ?? 1);
  });
  child.on("error", (err) => {
    console.error(`[cpanel] failed to spawn server: ${err.message}`);
    process.exit(1);
  });

  // forward signals so cPanel stop/restart works cleanly
  for (const sig of ["SIGINT", "SIGTERM", "SIGUSR2"]) {
    process.on(sig, () => {
      console.log(`[cpanel] received ${sig}, forwarding to server...`);
      child.kill(sig);
    });
  }
}
