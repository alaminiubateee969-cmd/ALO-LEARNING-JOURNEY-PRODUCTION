import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);

/**
 * Real health check.
 *
 * The previous version returned a hardcoded literal array: `Database: ok: true`
 * was never a query, and four capabilities were hardcoded `false`, so the route
 * always answered HTTP 200 with `"status":"PARTIAL"` — on a healthy box and on a
 * broken one alike. Combined with CI's `curl -sf … || echo`, a deploy was
 * reported green no matter what happened. See audit/02-VERIFIED-FINDINGS.md F1.
 *
 * This version actually probes each dependency and returns a non-2xx status when
 * a CRITICAL check fails, so `curl -f` (and any load balancer) can detect it.
 *
 * Check classes:
 *   critical — must pass for the app to serve traffic. Failure => HTTP 503.
 *   optional — a missing external binary/credential degrades a feature but the
 *              app still serves. Failure => HTTP 200 with status "degraded".
 *
 * `db` is imported lazily inside the handler on purpose: importing `@/lib/db` at
 * module scope would instantiate PrismaClient while Next "collects page data" at
 * build time, coupling the build to a reachable database.
 */

type Check = {
  name: string;
  ok: boolean;
  critical: boolean;
  detail: string;
};

const results: Check[] = [];

function record(
  name: string,
  critical: boolean,
  ok: boolean,
  detail: string
): boolean {
  results.push({ name, ok, critical, detail });
  return ok;
}

async function checkDatabase() {
  try {
    const { db } = await import("@/lib/db");
    const started = Date.now();
    // Cheapest possible real round-trip against the configured datasource.
    await db.$queryRaw`SELECT 1`;
    const ms = Date.now() - started;

    // Prove the ORM can actually read application data, not just the engine.
    let companies = "n/a";
    try {
      companies = String(await db.company.count());
    } catch (e) {
      record(
        "Database schema",
        true,
        false,
        `connection ok but Company.count() failed — schema likely not pushed: ${
          e instanceof Error ? e.message : String(e)
        }`.slice(0, 300)
      );
      return;
    }
    record(
      "Database",
      true,
      true,
      `query ok in ${ms}ms; Company rows=${companies}`
    );
  } catch (e) {
    record(
      "Database",
      true,
      false,
      `${e instanceof Error ? e.message : String(e)}`.slice(0, 300)
    );
  }
}

function checkEnv() {
  // Report the SHAPE of the connection target, never the value.
  const url = process.env.DATABASE_URL;
  if (!url) {
    record("DATABASE_URL", true, false, "not set — Prisma cannot connect");
    return;
  }
  const scheme = url.split(":")[0] || "unknown";
  const isFile = scheme === "file";
  const target = isFile
    ? `file path (${path.basename(url.replace(/^file:/, ""))})`
    : `${scheme}://<host redacted>`;
  record("DATABASE_URL", true, true, `set; scheme=${scheme}; ${target}`);
}

async function checkStorage() {
  // Every storage path in this app is process.cwd()-relative, so this also
  // verifies PM2 started the app from the intended directory.
  const dirs = [
    path.join(process.cwd(), "storage", "videos"),
    path.join(process.cwd(), "storage", "backups"),
  ];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const probe = path.join(dir, `.health-${Date.now()}.tmp`);
      await fs.writeFile(probe, "ok");
      await fs.unlink(probe);
      record(`Storage ${path.basename(dir)}`, true, true, `writable at ${dir}`);
    } catch (e) {
      record(
        `Storage ${path.basename(dir)}`,
        true,
        false,
        `not writable at ${dir}: ${
          e instanceof Error ? e.message : String(e)
        }`.slice(0, 200)
      );
    }
  }
  record(
    "Working directory",
    false,
    true,
    `cwd=${process.cwd()} (all storage paths are cwd-relative)`
  );
}

async function checkBinary(name: string, args: string[], label: string) {
  try {
    await run(name, args, { timeout: 5000 });
    record(label, false, true, `${name} available`);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    record(
      label,
      false,
      false,
      err?.code === "ENOENT"
        ? `${name} not installed — video/TTS features unavailable`
        : `${name} present but failed: ${err?.message ?? "unknown"}`.slice(0, 200)
    );
  }
}

export async function GET() {
  results.length = 0;

  record("Runtime", true, true, `Next.js ${process.env.__NEXT_PRIVATE_ORIGIN ? "" : ""}node ${process.version}`);

  checkEnv();
  await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkBinary("ffmpeg", ["-version"], "FFmpeg"),
    checkBinary("espeak", ["--version"], "espeak (Bengali TTS)"),
  ]);

  const failedCritical = results.filter((c) => c.critical && !c.ok);
  const failedOptional = results.filter((c) => !c.critical && !c.ok);

  const status = failedCritical.length
    ? "unhealthy"
    : failedOptional.length
      ? "degraded"
      : "ok";
  const httpStatus = failedCritical.length ? 503 : 200;

  return NextResponse.json(
    {
      status,
      // Backwards-compatible alias for anything still reading the old field.
      // Old values were "COMPLETE" | "PARTIAL"; "PARTIAL" was returned even when
      // healthy, so it carried no information. Map it faithfully anyway.
      legacyStatus: failedOptional.length || failedCritical.length ? "PARTIAL" : "COMPLETE",
      httpStatus,
      checks: results,
      summary: {
        total: results.length,
        failedCritical: failedCritical.map((c) => c.name),
        failedOptional: failedOptional.map((c) => c.name),
      },
      checkedAt: new Date().toISOString(),
    },
    { status: httpStatus }
  );
}
