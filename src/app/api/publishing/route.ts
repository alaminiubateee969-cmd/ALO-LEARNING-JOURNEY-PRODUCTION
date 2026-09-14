import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const posts = await db.publishedPost.findMany({ orderBy: { createdAt: "desc" } });

  // Stats
  const stats = {
    total: posts.length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    queued: posts.filter((p) => p.status === "queued").length,
    published: posts.filter((p) => p.status === "published").length,
    failed: posts.filter((p) => p.status === "failed").length,
    externalSetup: posts.filter((p) => p.status === "external_setup_required").length,
  };

  return NextResponse.json({ posts, stats });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { action, id, platform, topic, scheduledAt } = await req.json().catch(() => ({
    action: "schedule", id: "", platform: "", topic: "", scheduledAt: null,
  }));

  if (action === "schedule") {
    // Create a new scheduled post
    const post = await db.publishedPost.create({
      data: {
        platform: platform || "facebook",
        topic: topic || "Untitled",
        status: "scheduled",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 1000 * 60 * 60 * 2),
      },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "publishing.schedule", detail: `Scheduled ${platform} post for "${topic}"`, severity: "info" },
    });
    return NextResponse.json({ post });
  }

  if (action === "publish_now" && id) {
    const post = await db.publishedPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Check if the platform is actually connected with a real token.
    // We NEVER fake a provider post ID. If the platform is not connected,
    // we return external_setup_required.
    const conn = await db.socialConnection.findFirst({ where: { platform: post.platform } });
    if (!conn || conn.status !== "connected") {
      // Mark as external_setup_required — no fake success
      const updated = await db.publishedPost.update({
        where: { id },
        data: { status: "external_setup_required" },
      });
      await db.auditLog.create({
        data: {
          actor: "PublisherAgent",
          action: "publish.blocked",
          detail: `${post.platform} not connected — external_setup_required (no fake success)`,
          severity: "warn",
        },
      });
      return NextResponse.json({
        post: updated,
        status: "external_setup_required",
        message: `${post.platform} is not connected with a real OAuth token. Connect it via OAuth first.`,
      });
    }

    // In a real implementation, this is where we would call the platform's
    // official API (Meta Graph API, YouTube Data API, etc.) with the stored
    // access token. The call would be async and we'd poll for completion.
    // Since this sandbox has no real OAuth tokens configured, we cannot
    // make a real API call. We mark as external_setup_required rather than
    // faking a provider post ID.
    //
    // The seeded "connected" statuses are simulated (no real token exchange
    // happened), so we treat them as external_setup_required for actual
    // publishing.
    const updated = await db.publishedPost.update({
      where: { id },
      data: { status: "external_setup_required" },
    });
    await db.auditLog.create({
      data: {
        actor: "PublisherAgent",
        action: "publish.blocked",
        detail: `${post.platform} has no real OAuth token — external_setup_required`,
        severity: "warn",
      },
    });
    return NextResponse.json({
      post: updated,
      status: "external_setup_required",
      message: "Real OAuth token required for publishing. Configure provider credentials first.",
    });
  }

  if (action === "cancel" && id) {
    await db.publishedPost.update({ where: { id }, data: { status: "failed" } });
    await db.auditLog.create({
      data: { actor: "admin", action: "publishing.cancel", detail: `Cancelled post ${id}`, severity: "warn" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reschedule" && id && scheduledAt) {
    const updated = await db.publishedPost.update({
      where: { id },
      data: { scheduledAt: new Date(scheduledAt), status: "scheduled" },
    });
    return NextResponse.json({ post: updated });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
