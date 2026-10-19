import { NextRequest, NextResponse } from "next/server";
import { sendContactNotification, isEmailConfigured, emailDiagnostics } from "@/lib/email";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public contact endpoint — rate-limited via simple in-memory window
// Accepts: { name, email, phone?, message, topic? }
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 }); // 1 min window
    return false;
  }
  entry.count += 1;
  return entry.count > 5; // max 5/min per IP
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many requests — try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 120) : "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "validation", message: "name, email, message are required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "message_too_short", message: "Please write at least 10 characters" }, { status: 400 });
  }

  // Log to DB audit (no PII beyond name/email label)
  try {
    await db.auditLog.create({
      data: {
        actor: `contact:${email.slice(0, 3)}***`,
        action: "contact.enquiry_received",
        detail: `Contact enquiry: ${name} — ${topic || "general"} — ${message.length} chars`,
        severity: "info",
      },
    });
  } catch {
    // audit failure shouldn't block contact
  }

  // Attempt email delivery via cPanel SMTP
  if (!isEmailConfigured()) {
    const diag = emailDiagnostics();
    // Store lead as fallback even if mail not configured
    try {
      await db.marketingLead.create({
        data: {
          name,
          email,
          phone: phone || null,
          source: "website-contact",
          service: topic || null,
          notes: message,
          status: "new",
        },
      });
    } catch {}
    return NextResponse.json(
      {
        ok: true,
        delivered: false,
        warning: "Contact saved — email delivery is not yet configured (SMTP_PASS missing).",
        missing: diag.missing,
        // keep public error low-detail; full diagnostics via /api/email/test (admin)
      },
      { status: 202 }
    );
  }

  try {
    const result = await sendContactNotification({ name, email, phone, message, topic });
    // also save as lead for CRM
    try {
      await db.marketingLead.create({
        data: { name, email, phone: phone || null, source: "website-contact", service: topic || null, notes: message, status: "new" },
      });
    } catch {}
    return NextResponse.json({ ok: true, delivered: true, messageId: result.messageId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Still save lead so enquiry not lost
    try {
      await db.marketingLead.create({
        data: { name, email, phone: phone || null, source: "website-contact", service: topic || null, notes: message, status: "new" },
      });
    } catch {}
    return NextResponse.json({ ok: true, delivered: false, warning: "Enquiry saved but email delivery failed", error: msg.slice(0, 600) }, { status: 202 });
  }
}

// GET for diagnostics (public low-detail)
export async function GET() {
  return NextResponse.json({
    contact: "info@learn.aloeducation.com",
    phone: "01805-020103",
    facebook: "https://www.facebook.com/ALOLearningJourney",
    smtp: { host: "learn.aloeducation.com", port: 465, imapPort: 993, user: "info@learn.aloeducation.com" },
    instructions: "POST { name, email, phone?, message, topic? } to this endpoint",
  });
}
