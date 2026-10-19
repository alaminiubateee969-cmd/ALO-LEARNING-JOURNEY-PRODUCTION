import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { emailDiagnostics, verifySmtpConnection, sendTestEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/email/test — diagnostics (admin only)
export async function GET() {
  try {
    await requireOwner();
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 401;
    return NextResponse.json({ error: statusCode === 503 ? "administrator_auth_not_configured" : "unauthorized" }, { status: statusCode === 503 ? 503 : 401 });
  }

  const diag = emailDiagnostics();
  const verify = diag.configured ? await verifySmtpConnection() : { ok: false, message: `Missing: ${diag.missing.join(", ")}` };

  return NextResponse.json({
    email: "info@learn.aloeducation.com",
    imap: { host: "learn.aloeducation.com", port: 993, secure: true, user: "info@learn.aloeducation.com" },
    smtp: { host: diag.host, port: diag.port, secure: diag.secure, userMasked: diag.userMasked, from: diag.from },
    configured: diag.configured,
    missing: diag.missing,
    verify,
    // keep docs inline so admin sees cPanel location
    cpanelHint: "Password is set in cPanel → Email Accounts → info@learn.aloeducation.com → Manage → Password, then add SMTP_PASS in cPanel → Application Manager → Environment Variables",
  });
}

// POST /api/email/test — send a test mail (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireOwner();
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 401;
    return NextResponse.json({ error: statusCode === 503 ? "administrator_auth_not_configured" : "unauthorized" }, { status: statusCode === 503 ? 503 : 401 });
  }

  const body = await request.json().catch(() => ({}));
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "invalid_recipient", message: "Provide a valid 'to' email" }, { status: 400 });
  }

  const diag = emailDiagnostics();
  if (!diag.configured) {
    return NextResponse.json({ error: "smtp_not_configured", missing: diag.missing, diagnostics: diag }, { status: 503 });
  }

  const verify = await verifySmtpConnection();
  if (!verify.ok) {
    return NextResponse.json({ error: "smtp_verify_failed", message: verify.message, diagnostics: diag }, { status: 502 });
  }

  try {
    const result = await sendTestEmail(to);
    return NextResponse.json({ ok: true, messageId: result.messageId, to, from: diag.from });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "send_failed", message: msg.slice(0, 800) }, { status: 502 });
  }
}
