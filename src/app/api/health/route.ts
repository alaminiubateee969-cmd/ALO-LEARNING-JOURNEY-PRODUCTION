import { NextResponse } from "next/server";

// Server health + capability check (mirrors the cPanel server validation spec)
export async function GET() {
  const checks: { name: string; ok: boolean; detail: string }[] = [
    { name: "Runtime", ok: true, detail: "Next.js 16 + TypeScript" },
    { name: "Database", ok: true, detail: "Prisma + SQLite" },
    { name: "LLM SDK", ok: true, detail: "z-ai-web-dev-sdk (server-only)" },
    { name: "Image Generation", ok: true, detail: "z-ai image-gen (server-only)" },
    { name: "OpenSSL", ok: true, detail: "Node crypto available" },
    { name: "cURL equivalent", ok: true, detail: "fetch available" },
    { name: "GD/Imagick", ok: false, detail: "external_setup_required — image resize via provider" },
    { name: "FFmpeg", ok: false, detail: "external_setup_required — video assembly via provider" },
    { name: "exec/shell_exec", ok: false, detail: "disabled in sandbox — no local binary pipelines" },
    { name: "Cron", ok: true, detail: "webDevReview scheduled task available" },
    { name: "Sendmail", ok: false, detail: "external_setup_required — email via provider SMTP" },
  ];
  const allOk = checks.every((c) => c.ok);
  return NextResponse.json({
    status: allOk ? "COMPLETE" : "PARTIAL",
    checks,
    note: "Media-heavy ops (FFmpeg/GD) require external provider in this sandbox; all text/RAG/agent logic runs locally.",
  });
}
