import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function POST(req: Request) {
  await ensureSeeded();
  const { id, platform } = await req.json().catch(() => ({ id: "", platform: "facebook" }));

  const queued = id
    ? await db.publishedPost.findUnique({ where: { id } })
    : await db.publishedPost.findFirst({ where: { platform, status: "queued" }, orderBy: { createdAt: "asc" } });
  if (!queued) return NextResponse.json({ error: "no queued job" }, { status: 404 });

  // Check if the platform is actually connected with a real token.
  // We NEVER fake a provider post ID. If the platform is not connected
  // with a real OAuth token, we return external_setup_required.
  const conn = await db.socialConnection.findFirst({ where: { platform: queued.platform } });
  if (!conn || conn.status !== "connected") {
    const updated = await db.publishedPost.update({
      where: { id: queued.id },
      data: { status: "external_setup_required" },
    });
    await db.auditLog.create({
      data: {
        actor: "PublisherAgent",
        action: "publish.blocked",
        detail: `${queued.platform} not connected — external_setup_required (no fake success)`,
        severity: "warn",
      },
    });
    return NextResponse.json({
      post: updated,
      status: "external_setup_required",
      message: `${queued.platform} is not connected with a real OAuth token.`,
    });
  }

  // In a real implementation, this is where we would call the platform's
  // official API with the stored access token. Since this sandbox has no
  // real OAuth tokens configured (seeded "connected" statuses are simulated),
  // we cannot make a real API call. We mark as external_setup_required
  // rather than faking a provider post ID.
  const updated = await db.publishedPost.update({
    where: { id: queued.id },
    data: { status: "external_setup_required" },
  });
  await db.auditLog.create({
    data: {
      actor: "PublisherAgent",
      action: "publish.blocked",
      detail: `${queued.platform} has no real OAuth token — external_setup_required`,
      severity: "warn",
    },
  });
  return NextResponse.json({
    post: updated,
    status: "external_setup_required",
    message: "Real OAuth token required for publishing.",
  });
}
