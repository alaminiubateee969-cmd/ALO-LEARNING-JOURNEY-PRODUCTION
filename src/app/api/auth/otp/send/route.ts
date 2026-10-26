import { NextResponse } from "next/server";
import { isAdminOtpDeliveryConfigured } from "@/lib/auth-config";
import { verifyAdminCredentials } from "@/lib/auth";
import { AdminOtpRateLimitError, queueAdminOtp } from "@/lib/admin-otp";
import { db } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/same-origin";

export const runtime = "nodejs";
export const maxDuration = 20;


const genericAccepted = () => NextResponse.json(
  { accepted: true, message: "If the administrator credentials are valid, an SMS code has been queued." },
  { status: 202, headers: { "Cache-Control": "no-store" } }
);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "same_origin_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = typeof body.email === "string" && body.email.length <= 254 ? body.email : "";
  const password = typeof body.password === "string" && body.password.length <= 256 ? body.password : "";
  if (!email || !password || !verifyAdminCredentials(email, password)) return genericAccepted();

  if (!isAdminOtpDeliveryConfigured()) {
    return NextResponse.json({ error: "admin_otp_delivery_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await queueAdminOtp();
    await db.auditLog.create({
      data: {
        actor: "admin_auth",
        action: "auth.admin_otp.queued",
        detail: "SMS gateway accepted an administrator OTP request; handset delivery is not confirmed.",
        severity: "info",
      },
    }).catch(() => undefined);
    return genericAccepted();
  } catch (error) {
    if (error instanceof AdminOtpRateLimitError) {
      return NextResponse.json(
        { error: "otp_rate_limited", retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    await db.auditLog.create({
      data: {
        actor: "admin_auth",
        action: "auth.admin_otp.failed",
        detail: "Administrator OTP could not be queued by the configured SMS gateway.",
        severity: "warn",
      },
    }).catch(() => undefined);
    return NextResponse.json({ error: "otp_delivery_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
