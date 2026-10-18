import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { classifyComment, draftReply } from "@/lib/ai";

const REVIEW_REQUIRED = new Set([
  "medical_sensitive",
  "development_sensitive",
  "abuse_risk",
  "emergency",
  "toxic",
  "review_required",
]);

function requiresHumanReview(comment: { category: string; riskLevel: string }) {
  return comment.riskLevel === "high" || REVIEW_REQUIRED.has(comment.category);
}

export async function GET() {
  await ensureSeeded();
  const comments = await db.commentInbox.findMany({ orderBy: { createdAt: "desc" } });
  const stats = {
    total: comments.length,
    new: comments.filter((comment) => comment.status === "new").length,
    sensitive: comments.filter((comment) => REVIEW_REQUIRED.has(comment.category)).length,
    replied: comments.filter((comment) => comment.status === "replied").length,
    escalated: comments.filter((comment) => comment.status === "escalated").length,
  };
  return NextResponse.json({ comments, stats });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = typeof body.action === "string" ? body.action : "classify";

  if (action === "send") {
    return NextResponse.json({
      error: "external_reply_delivery_not_configured",
      status: "blocked",
      deliveryAttempted: false,
      message: "No platform reply was sent and no reply status was changed.",
    }, { status: 503 });
  }
  if (!id || id.length > 191) {
    return NextResponse.json({ error: "comment_id_required" }, { status: 400 });
  }

  if (action === "classify") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const result = await classifyComment(comment.text);
    const classification = result.usedFallback
      ? {
          category: "review_required",
          riskLevel: "medium",
          rationale: "Classifier unavailable; a human must review this comment.",
          autoReplyAllowed: false,
        }
      : result.data;
    const updated = await db.commentInbox.update({
      where: { id },
      data: {
        category: classification.category,
        riskLevel: classification.riskLevel,
        status: "classified",
      },
    });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "comment.classify",
        detail: `Comment ${id} classified via ${result.provider}; fallback=${result.usedFallback}; classification is not an independent safety check.`,
        severity: result.usedFallback || classification.riskLevel === "high" ? "warn" : "info",
      },
    });
    return NextResponse.json({
      comment: updated,
      rationale: classification.rationale,
      autoReplyAllowed: result.usedFallback ? false : classification.autoReplyAllowed,
      provider: result.provider,
      usedFallback: result.usedFallback,
      independentSafetyCheck: false,
    });
  }

  if (action === "draft") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (requiresHumanReview(comment)) {
      return NextResponse.json({
        error: "human_review_required",
        status: "needs_human_response",
        message: "Sensitive, high-risk, or unclassified comments cannot receive a generated reply draft.",
      }, { status: 403 });
    }
    const result = await draftReply(comment.text, comment.category);
    const updated = await db.commentInbox.update({ where: { id }, data: { draftReply: result.data.reply } });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "comment.reply_draft",
        detail: `Unsent reply draft created for ${id} via ${result.provider}; fallback=${result.usedFallback}; no platform delivery attempted.`,
        severity: result.usedFallback ? "warn" : "info",
      },
    });
    return NextResponse.json({
      comment: updated,
      tone: result.data.tone,
      provider: result.provider,
      usedFallback: result.usedFallback,
      deliveryAttempted: false,
    });
  }

  if (action === "save_draft") {
    const draftReply = typeof body.draftReply === "string" ? body.draftReply.trim() : "";
    if (!draftReply || draftReply.length > 5_000) {
      return NextResponse.json({ error: "draft_reply_must_contain_1_to_5000_characters" }, { status: 400 });
    }
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (requiresHumanReview(comment)) {
      return NextResponse.json({
        error: "human_review_required",
        status: "needs_human_response",
      }, { status: 403 });
    }
    const updated = await db.commentInbox.update({ where: { id }, data: { draftReply } });
    await db.auditLog.create({
      data: { actor: "admin", action: "comment.draft_save", detail: `Saved an unsent reply draft for comment ${id}; no platform delivery attempted.`, severity: "info" },
    });
    return NextResponse.json({
      comment: updated,
      status: "draft_saved",
      deliveryAttempted: false,
      message: "Draft saved locally; no platform message was sent.",
    });
  }

  if (action === "escalate") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const updated = await db.commentInbox.update({ where: { id }, data: { status: "escalated" } });
    await db.notification.create({
      data: {
        title: "মন্তব্য এসকেলেটেড",
        body: `একটি ${updated.category} মন্তব্য মানব পর্যালোচনায় পাঠানো হয়েছে`,
        kind: "warn",
      },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "comment.escalate", detail: `Escalated ${id} for in-app human review.`, severity: "warn" },
    });
    return NextResponse.json({ comment: updated, status: "marked_for_in_app_review" });
  }

  if (action === "ignore") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const updated = await db.commentInbox.update({ where: { id }, data: { status: "ignored" } });
    await db.auditLog.create({
      data: { actor: "admin", action: "comment.ignore", detail: `Comment ${id} marked ignored locally.`, severity: "info" },
    });
    return NextResponse.json({ comment: updated, status: "ignored_locally" });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
