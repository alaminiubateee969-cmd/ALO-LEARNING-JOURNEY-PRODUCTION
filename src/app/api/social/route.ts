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
  return NextResponse.json({ connections: list });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { platform, action } = await req.json().catch(() => ({
    platform: "",
    action: "connect",
  }));
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
  return NextResponse.json({ platform, status });
}
