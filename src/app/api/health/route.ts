import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { db } from "@/lib/db";

/**
 * GET /api/health
 * Real runtime capability check — actually probes the environment.
 */
export async function GET() {
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // Runtime
  checks.push({ name: "Runtime", ok: true, detail: `Next.js 16 + Node ${process.version}` });

  // Database (real ping)
  try {
    await db.$queryRaw`SELECT 1`;
    checks.push({ name: "Database", ok: true, detail: "Prisma + SQLite connected" });
  } catch (e) {
    checks.push({ name: "Database", ok: false, detail: `DB error: ${(e as Error).message}` });
  }

  // FFmpeg (real probe)
  try {
    const v = execSync("ffmpeg -version 2>/dev/null | head -1", { encoding: "utf-8" }).trim();
    checks.push({ name: "FFmpeg", ok: !!v, detail: v || "not found" });
  } catch {
    checks.push({ name: "FFmpeg", ok: false, detail: "not installed" });
  }

  // ffprobe
  try {
    execSync("ffprobe -version 2>/dev/null", { encoding: "utf-8" });
    checks.push({ name: "ffprobe", ok: true, detail: "available" });
  } catch {
    checks.push({ name: "ffprobe", ok: false, detail: "not installed" });
  }

  // DejaVu font (for FFmpeg drawtext)
  const fontOk = existsSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
  checks.push({
    name: "DejaVu Font",
    ok: fontOk,
    detail: fontOk ? "available" : "missing — title cards will fail",
  });

  // z-ai SDK
  try {
    require.resolve("z-ai-web-dev-sdk");
    checks.push({ name: "z-ai SDK", ok: true, detail: "installed (server-only)" });
  } catch {
    checks.push({ name: "z-ai SDK", ok: false, detail: "not installed" });
  }

  // NextAuth
  const authOk = !!(process.env.NEXTAUTH_SECRET && process.env.ALO_ADMIN_EMAIL && process.env.ALO_ADMIN_PASSWORD_HASH);
  checks.push({
    name: "Auth (production)",
    ok: authOk,
    detail: authOk ? "NextAuth configured" : "DEV_AUTH fallback (no NEXTAUTH_SECRET) — NOT for production",
  });

  // Lip-sync service
  const lipSyncOk = !!process.env.LIPSYNC_SERVICE_URL;
  checks.push({
    name: "Lip-sync service",
    ok: lipSyncOk,
    detail: lipSyncOk ? `configured: ${process.env.LIPSYNC_SERVICE_URL}` : "not configured (talking-portrait mode)",
  });

  // Cron secret
  const cronOk = !!process.env.CRON_SECRET;
  checks.push({
    name: "Cron secret",
    ok: cronOk,
    detail: cronOk ? "configured" : "missing — recovery sweep cron won't authenticate",
  });

  const allOk = checks.every((c) => c.ok);
  return NextResponse.json({
    status: allOk ? "COMPLETE" : "PARTIAL",
    timestamp: new Date().toISOString(),
    uptime_sec: Math.round(process.uptime()),
    checks,
  });
}
