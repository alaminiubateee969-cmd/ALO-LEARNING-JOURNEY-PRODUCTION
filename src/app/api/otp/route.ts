import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authFailure(error: unknown) {
  const statusCode = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode: unknown }).statusCode)
    : 401;
  const status = statusCode === 503 ? 503 : 401;
  return NextResponse.json({ error: status === 503 ? "administrator_auth_not_configured" : "unauthorized" }, { status });
}

// This generic OTP service has no verified delivery provider. It remains
// unavailable rather than returning simulated codes or claiming delivery.
export async function GET() {
  try {
    await requireOwner();
  } catch (error) {
    return authFailure(error);
  }

  try {
    const recent = await db.otpRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        channel: true,
        recipientLabel: true,
        purpose: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        expiresAt: true,
        verifiedAt: true,
        createdAt: true,
      },
    });
    const stats = {
      total: recent.length,
      pending: recent.filter((request) => request.status === "pending").length,
      delivered: recent.filter((request) => request.status === "delivered").length,
      verified: recent.filter((request) => request.status === "verified").length,
      expired: recent.filter((request) => request.status === "expired").length,
      failed: recent.filter((request) => request.status === "failed").length,
    };
    return NextResponse.json({ requests: recent, stats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "otp_service_unavailable" }, { status: 503 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    await requireOwner();
  } catch (error) {
    return authFailure(error);
  }
  return NextResponse.json(
    { ok: false, error: "otp_delivery_not_configured", message: "No verified SMS, email, WhatsApp, or voice delivery provider is configured. No code was generated or stored." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
