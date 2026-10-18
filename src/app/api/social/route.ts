import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { PLATFORMS } from "@/lib/platforms";

export async function GET() {
  await ensureSeeded();
  const conns = await db.socialConnection.findMany({ orderBy: { platform: "asc" } });
  const list = PLATFORMS.map((p) => ({
    ...p,
    connection: conns.find((c) => c.platform === p.id) ?? null,
  }));
  return NextResponse.json({
    connections: list,
    oauthImplemented: false,
    providerChecked: false,
    message: "Connection entries are stored metadata. This application has no OAuth callback/token storage or provider connectivity check; connected labels are unverified.",
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => null) as { platform?: unknown; action?: unknown } | null;
  const platform = body?.platform;
  const action = body?.action;
  if (typeof platform !== "string" || !PLATFORMS.some((candidate) => candidate.id === platform)) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  }
  if (action !== "connect" && action !== "disconnect") {
    return NextResponse.json({ error: "Action must be connect or disconnect." }, { status: 400 });
  }
  const existing = await db.socialConnection.findFirst({ where: { platform } });
  // We NEVER store passwords/OTPs. This simulates the OAuth round-trip:
  // In production the admin is redirected to the provider OAuth URL.
  const status = action === "disconnect" ? "not_connected" : "external_setup_required";
  if (existing) {
    await db.socialConnection.update({
      where: { id: existing.id },
      data: { status },
    });
  } else {
    await db.socialConnection.create({
      data: { platform, accountName: `${platform} (pending)`, status },
    });
  }
  await db.auditLog.create({
    data: {
      actor: "admin",
      action: `social.${action}`,
      detail: `${platform} → ${status}`,
      severity: status === "external_setup_required" ? "warn" : "info",
    },
  });
  return NextResponse.json({
    platform,
    status,
    oauthStarted: false,
    providerChecked: false,
    message: "Only the local connection-status record changed; no OAuth redirect or provider request was made.",
  });
}
