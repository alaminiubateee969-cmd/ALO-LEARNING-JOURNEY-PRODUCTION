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
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_json_object" }, { status: 400 });
  }
  const { action, id, platform, topic, scheduledAt } = body as Record<string, unknown>;
  if (typeof action !== "string") {
    return NextResponse.json({ error: "action_required" }, { status: 400 });
  }
  await ensureSeeded();

  if (action === "schedule") {
    if (typeof topic !== "string" || !topic.trim() || topic.length > 5000) {
      return NextResponse.json({ error: "topic_required" }, { status: 400 });
    }
    const requestedDate = scheduledAt === undefined || scheduledAt === null
      ? new Date(Date.now() + 1000 * 60 * 60 * 2)
      : new Date(String(scheduledAt));
    if (Number.isNaN(requestedDate.getTime())) {
      return NextResponse.json({ error: "invalid_scheduled_at" }, { status: 400 });
    }
    // Save schedule metadata only; this does not create a delivery job.
    const post = await db.publishedPost.create({
      data: {
        platform: typeof platform === "string" && platform ? platform.slice(0, 100) : "facebook",
        topic: topic.trim(),
        status: "scheduled",
        scheduledAt: requestedDate,
      },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "publishing.schedule", detail: `Scheduled ${platform} post for "${topic}"`, severity: "info" },
    });
    return NextResponse.json({ post });
  }

  if (action === "publish_now" && typeof id === "string" && id) {
    const post = await db.publishedPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

    // This checks only a stored connection status. It does not inspect a token
    // or contact a provider; external delivery is not implemented here.
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
          detail: `${post.platform} stored connection status is not connected — external_setup_required; no provider call made`,
          severity: "warn",
        },
      });
      return NextResponse.json({
        post: updated,
        status: "external_setup_required",
        deliveryAttempted: false,
        message: "External delivery is disabled: this application has no implemented social OAuth flow or platform publishing client. No post was sent.",
      });
    }

    // A stored `connected` flag is not evidence of OAuth or provider access.
    // No token exchange or platform publishing client is implemented, so the
    // route blocks delivery regardless of the stored connection status.
    const updated = await db.publishedPost.update({
      where: { id },
      data: { status: "external_setup_required" },
    });
    await db.auditLog.create({
      data: {
        actor: "PublisherAgent",
        action: "publish.blocked",
        detail: `${post.platform} stored connection status is not proof of provider access — external_setup_required; no provider call made`,
        severity: "warn",
      },
    });
    return NextResponse.json({
      post: updated,
      status: "external_setup_required",
      deliveryAttempted: false,
      message: "External delivery is disabled: this application has no implemented social OAuth flow or platform publishing client. No post was sent.",
    });
  }

  if (action === "cancel" && typeof id === "string" && id) {
    await db.publishedPost.update({ where: { id }, data: { status: "failed" } });
    await db.auditLog.create({
      data: { actor: "admin", action: "publishing.cancel", detail: `Marked queue record ${id} failed; no external post was cancelled.`, severity: "warn" },
    });
    return NextResponse.json({ ok: true, externalCancellationPerformed: false });
  }

  if (action === "reschedule" && typeof id === "string" && id && typeof scheduledAt === "string") {
    const requestedDate = new Date(scheduledAt);
    if (Number.isNaN(requestedDate.getTime())) {
      return NextResponse.json({ error: "invalid_scheduled_at" }, { status: 400 });
    }
    const updated = await db.publishedPost.update({
      where: { id },
      data: { scheduledAt: requestedDate, status: "scheduled" },
    });
    return NextResponse.json({ post: updated, deliveryScheduled: false });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
