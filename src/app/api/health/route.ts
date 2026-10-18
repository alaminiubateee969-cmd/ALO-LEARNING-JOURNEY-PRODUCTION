import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { localMediaBinaries, resolveFfmpegBinary, resolveFfprobeBinary } from "@/lib/local-audio";
import { getAudioStorageDir, getBackupStorageDir, getVideoStorageDir } from "@/lib/storage-paths";

const run = promisify(execFile);

type Check = {
  name: string;
  ok: boolean;
  critical: boolean;
  detail: string;
};

function record(
  results: Check[],
  name: string,
  critical: boolean,
  ok: boolean,
  detail: string
) {
  results.push({ name, ok, critical, detail });
}

async function checkDatabase(results: Check[]) {
  try {
    const { db } = await import("@/lib/db");
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    const companies = String(await db.company.count());
    const ms = Date.now() - started;
    record(results, "Database", true, true, `query and Company schema check ok in ${ms}ms; Company rows=${companies}`);
  } catch (error) {
    record(
      results,
      "Database",
      true,
      false,
      `${error instanceof Error ? error.message : String(error)}`.slice(0, 300)
    );
  }
}

function checkEnv(results: Check[]) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const developmentFallback = process.env.NODE_ENV !== "production";
    record(
      results,
      "DATABASE_URL",
      true,
      developmentFallback,
      developmentFallback
        ? "unset; local JSON persistence is a development-only fallback"
        : "missing in production; a configured MySQL connection is required"
    );
    return;
  }
  const scheme = url.split(":")[0] || "unknown";
  const isFile = scheme === "file";
  const target = isFile
    ? `file path (${path.basename(url.replace(/^file:/, ""))})`
    : `${scheme}://<host redacted>`;
  const mysqlRequired = process.env.NODE_ENV === "production";
  const mysqlConfigured = scheme === "mysql" || scheme === "mysqls";
  const ok = !mysqlRequired || mysqlConfigured;
  record(results, "DATABASE_URL", true, ok, `set; scheme=${scheme}; ${target}${!ok ? "; production requires MySQL" : ""}`);
}

async function checkCoreConfiguration(results: Check[]) {
  const url = process.env.DATABASE_URL ?? "";
  const scheme = url.split(":")[0] || "";
  const mysqlOk = Boolean(url) && (process.env.NODE_ENV !== "production" || scheme === "mysql" || scheme === "mysqls");
  record(results, "MySQL configuration", true, mysqlOk, mysqlOk ? "configured" : "production requires a MySQL DATABASE_URL");

  const { isAdminAuthenticationConfigured } = await import("@/lib/auth-config");
  const authOk = isAdminAuthenticationConfigured();
  const authIsCritical = process.env.NODE_ENV === "production";
  record(
    results,
    "Administrator authentication",
    authIsCritical,
    authOk,
    authOk ? "configured" : "not configured; production admin routes fail closed",
  );
}

async function checkStorage(results: Check[]) {
  const dirs = [
    getVideoStorageDir(),
    getAudioStorageDir(),
    getBackupStorageDir(),
  ];
  for (const dir of dirs) {
    const probe = path.join(dir, `.health-${randomUUID()}.tmp`);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(probe, "ok", { flag: "wx" });
      await fs.unlink(probe);
      record(results, `Storage ${path.basename(dir)}`, true, true, `writable at ${dir}`);
    } catch (error) {
      await fs.rm(probe, { force: true }).catch(() => undefined);
      record(
        results,
        `Storage ${path.basename(dir)}`,
        true,
        false,
        `not writable at ${dir}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200)
      );
    }
  }
  record(results, "Working directory", false, true, `cwd=${process.cwd()}`);
}

async function checkBinary(results: Check[], binaryPath: string, args: string[], label: string) {
  try {
    await run(binaryPath, args, { timeout: 5000 });
    record(results, label, false, true, `${path.basename(binaryPath)} available`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    record(
      results,
      label,
      false,
      false,
      err?.code === "ENOENT"
        ? `${path.basename(binaryPath)} not installed`
        : `${path.basename(binaryPath)} present but failed: ${err?.message ?? "unknown"}`.slice(0, 200)
    );
  }
}

async function checkLocalSpeech(results: Check[]) {
  const binaries = localMediaBinaries();
  if (binaries.piper) {
    record(results, "Local speech", false, true, "Piper executable and model path configured");
    return;
  }
  if (binaries.espeak) {
    record(results, "Local speech", false, true, "Local speech synthesizer ready (eSpeak / built-in formant WAV)");
    return;
  }
  record(results, "Local speech", false, false, "No local speech engine available");
}

/**
 * The default public response is a low-detail readiness probe: it checks the
 * database connection and core schema, but never returns host paths or errors.
 * Add `?details=1` for diagnostics; middleware requires an admin session in
 * production before this query is served.
 */
export async function GET(request: Request) {
  const results: Check[] = [];
  const detailsRequested = new URL(request.url).searchParams.get("details") === "1";
  await checkCoreConfiguration(results);

  if (detailsRequested) {
    record(results, "Runtime", true, true, `node ${process.version}`);
    checkEnv(results);
    await Promise.all([
      checkDatabase(results),
      checkStorage(results),
      checkBinary(results, resolveFfmpegBinary(), ["-version"], "FFmpeg"),
      checkBinary(results, resolveFfprobeBinary(), ["-version"], "FFprobe"),
      checkLocalSpeech(results),
    ]);
  } else {
    await checkDatabase(results);
  }

  const failedCritical = results.filter((check) => check.critical && !check.ok);
  const failedOptional = results.filter((check) => !check.critical && !check.ok);
  const status = failedCritical.length ? "unhealthy" : failedOptional.length ? "degraded" : "ok";
  const httpStatus = failedCritical.length ? 503 : 200;
  const checkedAt = new Date().toISOString();
  const summary = {
    total: results.length,
    failedCritical: failedCritical.map((check) => check.name),
    failedOptional: failedOptional.map((check) => check.name),
  };
  const legacyStatus = failedOptional.length || failedCritical.length ? "PARTIAL" : "COMPLETE";
  const releaseSha = /^[0-9a-f]{40}$/.test(process.env.RELEASE_SHA ?? "") ? process.env.RELEASE_SHA : "unknown";
  const baseResponse = { status, legacyStatus, httpStatus, checkedAt, releaseSha };

  return NextResponse.json(
    detailsRequested ? { ...baseResponse, checks: results, summary } : baseResponse,
    { status: httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
